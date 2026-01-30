const express = require('express');
const https = require('https'); // Usiamo HTTPS invece di HTTP
const fs = require('fs');       // Necessario per leggere i file del certificato
const { Server } = require('socket.io');
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

const app = express();

// 1. Configura i certificati (assicurati che i file siano nella cartella del server)
// const options = {
//     key: fs.readFileSync('./cert/localhost+2-key.pem'),
//     cert: fs.readFileSync('./cert/localhost+2.pem')
// };

// 2. Crea il server HTTPS
// const server = https.createServer(options, app);

// USA QUESTA VERSIONE (standard)
const http = require('http');
const server = http.createServer(app);

// 3. Collega Socket.io al server HTTPS
const io = new Server(server, {
    cors: { 
        origin: "*", // URL del tuo React in HTTPS
        methods: ["GET", "POST"]
    }
});

console.log('ℹ️ [INIT] Server HTTPS e Socket.IO (WSS) configurati');

let waitingUser = null;

io.on('connection', (socket) => {
    console.log('✅ [CONNESSIONE] Utente connesso via WSS:', socket.id);

    socket.on('queue:join', async () => {
        console.log('🔍 [QUEUE] Utente ' + socket.id + ' in coda');
        
        if (waitingUser && waitingUser.id !== socket.id) {
            console.log('✨ [MATCH] Match tra ' + waitingUser.id + ' e ' + socket.id);
            try {
                const matchData = { url: 'https://echoapp.daily.co/AYfkpmGrGRrVUK5poGx4', roomId: '69d10842-2432-45b5-a3ea-c243b59ac10c' };

                io.to(socket.id).emit('match:found', matchData);
                io.to(waitingUser.id).emit('match:found', matchData);

                waitingUser = null;
                console.log('✅ [MATCH] Completato');
            } catch (err) {
                console.error('❌ [ERRORE] Daily.co:', err.message);
                socket.emit('match:error', { message: "Errore tecnico" });
            }
        } else {
            waitingUser = socket;
            socket.emit('queue:searching');
        }
    });

    socket.on('disconnect', () => {
        if (waitingUser && waitingUser.id === socket.id) waitingUser = null;
    });
});

// Nota: 0.0.0.0 permette l'ascolto su tutti gli indirizzi, incluso il tuo IP 1.54
server.listen(process.env.PORT || 4000, '0.0.0.0', () => {
    console.log('═════════════════════════════════════════');
    console.log('🚀 Server avviato!');
    console.log('═════════════════════════════════════════');
});