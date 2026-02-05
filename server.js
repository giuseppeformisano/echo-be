/**
 * File principale del server - Punto di entrata
 */

const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const config = require("./src/config");
const setupSocketHandlers = require("./src/socket-handlers");

// Inizializzazione Express
const app = express();

// Configurazione server HTTP/HTTPS
let server;
const sslOptions = config.getServerOptions();

if (sslOptions) {
  server = https.createServer(sslOptions, app);
} else {
  server = http.createServer(app);
}

// Setup Socket.IO
const io = new Server(server, config.socketIOConfig);

// Setup degli event handler Socket.IO
setupSocketHandlers(io);

// Log iniziali
console.log("ℹ️ [INIT] Server HTTP e Socket.IO configurati");
if (config.DAILY_API_KEY) {
  console.log("ℹ️ [INIT] Daily.co API Key caricata.");
} else {
  console.warn(
    "⚠️ [WARN] Daily.co API Key MANCANTE! Le stanze non verranno create."
  );
}

// Avvio del server
server.listen(config.PORT, "0.0.0.0", () => {
  console.log("═════════════════════════════════════════");
  console.log(`🚀 Server avviato sulla porta ${config.PORT}`);
  console.log("═════════════════════════════════════════");
});
