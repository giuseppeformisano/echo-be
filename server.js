const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
require("dotenv").config({ path: __dirname + "/.env" });
const fs = require("fs");
const https = require("https");
const app = express();

let server;
if (process.env.NODE_ENV === "production") {
  server = http.createServer(app);
} else {
  const options = {
    key: fs.readFileSync("./cert/localhost+2-key.pem"),
    cert: fs.readFileSync("./cert/localhost+2.pem"),
  };
  server = https.createServer(options, app);
}

// --- Configurazione ---
const PORT = process.env.PORT || 4000;
const DAILY_API_KEY = process.env.DAILY_API_KEY;

// --- Setup Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

console.log("ℹ️ [INIT] Server HTTP e Socket.IO configurati");
if (DAILY_API_KEY) {
  console.log("ℹ️ [INIT] Daily.co API Key caricata.");
} else {
  console.warn(
    "⚠️ [WARN] Daily.co API Key MANCANTE! Le stanze non verranno create.",
  );
}

// --- Stato dell'applicazione ---
let venters = []; // Coda Sfogatori
let listeners = []; // Coda Ascoltatori
const activeRooms = new Map(); // roomId -> Set<socketId>
const socketRoomMap = new Map(); // socketId -> roomId
const callSessions = new Map(); // roomId -> { usersConnected: number, callDuration: number|null, startTime: number|null }

// --- Funzioni Helper Daily.co ---
const createDailyRoom = async () => {
  try {
    const response = await axios.post(
      "https://api.daily.co/v1/rooms",
      {
        properties: {
          exp: Math.round(Date.now() / 1000) + 3600, // Scadenza 1 ora
        },
      },
      {
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("❌ [DAILY] Errore creazione stanza:", error.message);
    throw error;
  }
};

const deleteDailyRoom = async (roomId) => {
  try {
    await axios.delete(`https://api.daily.co/v1/rooms/${roomId}`, {
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ [DAILY] Stanza ${roomId} eliminata.`);
  } catch (error) {
    console.error(
      `❌ [DAILY] Errore eliminazione stanza ${roomId}:`,
      error.message,
    );
  }
};

const startMatch = async (user1, user2) => {
  console.log(`✨ [MATCH] Trovato: ${user1.id} <-> ${user2.id}`);

  try {
    const roomData = await createDailyRoom();
    const matchPayload = { url: roomData.url, roomId: roomData.name };

    // Aggiorna stato stanze
    const participants = new Set([user1.id, user2.id]);
    activeRooms.set(roomData.name, participants);
    socketRoomMap.set(user1.id, roomData.name);
    socketRoomMap.set(user2.id, roomData.name);

    // Notifica entrambi gli utenti
    io.to(user1.id).emit("match:found", matchPayload);
    io.to(user2.id).emit("match:found", matchPayload);

    console.log("✅ [MATCH] Stanze assegnate e utenti notificati.");
  } catch (err) {
    // Notifica errore ai client se la creazione stanza fallisce
    const errorMsg = { message: "Errore tecnico nella creazione della stanza" };
    user1.emit("match:error", errorMsg);
    user2.emit("match:error", errorMsg);
  }
};

// --- Gestione Eventi Socket ---
io.on("connection", (socket) => {
  console.log(`✅ [CONNESSIONE] Utente connesso: ${socket.id}`);

  // Funzione unificata per pulire lo stato dell'utente (coda o stanza)
  const cleanupUser = async () => {
    // 1. Rimuovi dalle code se presente
    const venterIndex = venters.findIndex((s) => s.id === socket.id);
    if (venterIndex > -1) {
      venters.splice(venterIndex, 1);
      console.log(`🚶 [QUEUE] Venter ${socket.id} rimosso dalla coda.`);
    }
    const listenerIndex = listeners.findIndex((s) => s.id === socket.id);
    if (listenerIndex > -1) {
      listeners.splice(listenerIndex, 1);
      console.log(`🚶 [QUEUE] Listener ${socket.id} rimosso dalla coda.`);
    }

    // 2. Gestione uscita dalla stanza
    const roomId = socketRoomMap.get(socket.id);
    if (roomId) {
      const participants = activeRooms.get(roomId);
      if (participants) {
        participants.delete(socket.id);
        socketRoomMap.delete(socket.id);
        console.log(
          `🚪 [ROOM] Utente ${socket.id} uscito dalla stanza ${roomId}`,
        );

        // Aggiorna la sessione di chiamata
        const session = callSessions.get(roomId);
        if (session) {
          session.usersConnected -= 1;

          // Se ci sono ancora utenti connessi, calcola la durata
          if (session.usersConnected > 0 && session.startTime !== null) {
            session.callDuration = Math.floor(
              (Date.now() - session.startTime) / 1000,
            ); // in secondi
            console.log(
              `⏱️ [CALL] Durata chiamata ${roomId}: ${session.callDuration}s`,
            );
          }

          console.log(
            `👥 [CALL] Utenti rimanenti in ${roomId}: ${session.usersConnected}`,
          );
        }

        // Se la stanza è vuota, eliminala
        if (participants.size === 0) {
          console.log(`🧹 [ROOM] Stanza ${roomId} vuota. Eliminazione...`);

          // Rimuovi la sessione di chiamata
          const finalSession = callSessions.get(roomId);
          if (finalSession) {
            if (finalSession.startTime !== null) {
              finalSession.callDuration = Math.floor(
                (Date.now() - finalSession.startTime) / 1000,
              );
              console.log(
                `📊 [CALL] Sessione ${roomId} terminata. Durata totale: ${finalSession.callDuration}s`,
              );
            }
            callSessions.delete(roomId);
          }

          activeRooms.delete(roomId);
          await deleteDailyRoom(roomId);
        }
      }
    }
  };

  socket.on("queue:join", ({ role }) => {
    console.log(`🔍 [QUEUE] Utente ${socket.id} cerca match come ${role}...`);
    if (role === "venter") {
      if (listeners.length > 0) {
        const partner = listeners.shift();
        startMatch(socket, partner);
      } else {
        venters.push(socket);
        socket.emit("queue:searching");
        console.log(`⏳ [QUEUE] Venter ${socket.id} in attesa.`);
      }
    } else {
      // Logica speculare per listener
      if (venters.length > 0) {
        const partner = venters.shift();
        startMatch(partner, socket);
      } else {
        listeners.push(socket);
        socket.emit("queue:searching");
        console.log(`⏳ [QUEUE] Listener ${socket.id} in attesa.`);
      }
    }
  });

  socket.on("queue:leave", () => {
    cleanupUser();
  });

  socket.on("call:joined", ({ roomId }) => {
    console.log(
      `📞 [CALL] Utente ${socket.id} si è unito alla chiamata ${roomId}`,
    );

    // Inizializza o aggiorna la sessione di chiamata
    if (!callSessions.has(roomId)) {
      callSessions.set(roomId, {
        usersConnected: 1,
        callDuration: null,
        startTime: null,
      });
      console.log(`🆕 [CALL] Nuova sessione creata per stanza ${roomId}`);
    } else {
      const session = callSessions.get(roomId);
      session.usersConnected += 1;

      // Se è il secondo utente, inizia a tracciare il tempo
      if (session.usersConnected === 2 && session.startTime === null) {
        session.startTime = Date.now();
        console.log(`⏱️ [CALL] Timer avviato per stanza ${roomId}`);
      }

      console.log(
        `👥 [CALL] Utenti connessi in ${roomId}: ${session.usersConnected}`,
      );
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 [DISCONN] Utente ${socket.id} disconnesso.`);
    cleanupUser();
  });
});

// --- Avvio Server ---
server.listen(PORT, "0.0.0.0", () => {
  console.log("═════════════════════════════════════════");
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log("═════════════════════════════════════════");
});
