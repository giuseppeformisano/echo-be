const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

const app = express();
const server = http.createServer(app);

// --- Configurazione ---
const PORT = process.env.PORT || 4000;
const DAILY_API_KEY = process.env.DAILY_API_KEY;

// --- Setup Socket.IO ---
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

console.log('ℹ️ [INIT] Server HTTP e Socket.IO configurati');
if (DAILY_API_KEY) {
    console.log('ℹ️ [INIT] Daily.co API Key caricata.');
} else {
    console.warn('⚠️ [WARN] Daily.co API Key MANCANTE! Le stanze non verranno create.');
}

// --- Stato dell'applicazione ---
let waitingUser = null;
const activeRooms = new Map();   // roomId -> Set<socketId>
const socketRoomMap = new Map(); // socketId -> roomId

// --- Funzioni Helper Daily.co ---
const createDailyRoom = async () => {
    try {
        const response = await axios.post('https://api.daily.co/v1/rooms', {
            properties: {
                exp: Math.round(Date.now() / 1000) + 3600 // Scadenza 1 ora
            }
        }, {
            headers: {
                Authorization: `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('❌ [DAILY] Errore creazione stanza:', error.message);
        throw error;
    }
};

const deleteDailyRoom = async (roomId) => {
    try {
        await axios.delete(`https://api.daily.co/v1/rooms/${roomId}`, {
            headers: {
                Authorization: `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ [DAILY] Stanza ${roomId} eliminata.`);
    } catch (error) {
        console.error(`❌ [DAILY] Errore eliminazione stanza ${roomId}:`, error.message);
    }
};

// --- Gestione Eventi Socket ---
io.on('connection', (socket) => {
    console.log(`✅ [CONNESSIONE] Utente connesso: ${socket.id}`);

    // Funzione unificata per pulire lo stato dell'utente (coda o stanza)
    const cleanupUser = async () => {
        // 1. Rimuovi dalla coda se presente
        if (waitingUser && waitingUser.id === socket.id) {
            waitingUser = null;
            console.log(`🚶 [QUEUE] Utente ${socket.id} rimosso dalla coda.`);
        }

        // 2. Gestione uscita dalla stanza
        const roomId = socketRoomMap.get(socket.id);
        if (roomId) {
            const participants = activeRooms.get(roomId);
            if (participants) {
                participants.delete(socket.id);
                socketRoomMap.delete(socket.id);
                console.log(`🚪 [ROOM] Utente ${socket.id} uscito dalla stanza ${roomId}`);

                // Se la stanza è vuota, eliminala
                if (participants.size === 0) {
                    console.log(`🧹 [ROOM] Stanza ${roomId} vuota. Eliminazione...`);
                    activeRooms.delete(roomId);
                    await deleteDailyRoom(roomId);
                }
            }
        }
    };

    socket.on('queue:join', async () => {
        console.log(`🔍 [QUEUE] Utente ${socket.id} cerca match...`);

        // Se c'è già qualcuno in attesa (e non è lo stesso utente)
        if (waitingUser && waitingUser.id !== socket.id) {
            const peer = waitingUser;
            waitingUser = null; // Resetta la coda immediatamente

            console.log(`✨ [MATCH] Trovato: ${peer.id} <-> ${socket.id}`);

            try {
                const roomData = await createDailyRoom();
                const matchPayload = { url: roomData.url, roomId: roomData.name };

                // Aggiorna stato stanze
                const participants = new Set([socket.id, peer.id]);
                activeRooms.set(roomData.name, participants);
                socketRoomMap.set(socket.id, roomData.name);
                socketRoomMap.set(peer.id, roomData.name);

                // Notifica entrambi gli utenti
                io.to(socket.id).emit('match:found', matchPayload);
                io.to(peer.id).emit('match:found', matchPayload);

                console.log('✅ [MATCH] Stanze assegnate e utenti notificati.');
            } catch (err) {
                // Notifica errore ai client se la creazione stanza fallisce
                const errorMsg = { message: "Errore tecnico nella creazione della stanza" };
                socket.emit('match:error', errorMsg);
                peer.emit('match:error', errorMsg);
            }
        } else {
            // Nessuno in coda, mettiti in attesa
            waitingUser = socket;
            socket.emit('queue:searching');
            console.log(`⏳ [QUEUE] Utente ${socket.id} in attesa.`);
        }
    });

    socket.on('queue:leave', () => {
        cleanupUser();
    });

    socket.on('disconnect', () => {
        console.log(`🔌 [DISCONN] Utente ${socket.id} disconnesso.`);
        cleanupUser();
    });
});

// --- Avvio Server ---
server.listen(PORT, '0.0.0.0', () => {
    console.log('═════════════════════════════════════════');
    console.log(`🚀 Server avviato sulla porta ${PORT}`);
    console.log('═════════════════════════════════════════');
});