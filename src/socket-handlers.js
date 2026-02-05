/**
 * Gestione degli event handler Socket.IO
 */

const queueService = require("./queue-service");
const RoomService = require("./room-service");
const MatchingService = require("./matching-service");

module.exports = function setupSocketHandlers(io) {
  const roomService = new RoomService();
  const matchingService = new MatchingService(io);

  io.on("connection", (socket) => {
    console.log(`✅ [CONNESSIONE] Utente connesso: ${socket.id}`);

    /**
     * Pulisce lo stato dell'utente (rimuove dalle code o dalla stanza)
     */
    const cleanupUser = async () => {
      // Rimuovi dalle code
      queueService.handleQueueLeave(socket.id);

      // Gestione uscita dalla stanza
      await roomService.handleRoomExit(socket.id);
    };

    /**
     * Evento: Utente vuole unirsi alla coda
     */
    socket.on("queue:join", ({ role }) => {
      queueService.handleQueueJoin(
        socket,
        role,
        (user1, user2) => {
          matchingService.startMatch(user1, user2);
        }
      );
    });

    /**
     * Evento: Utente vuole uscire dalla coda
     */
    socket.on("queue:leave", () => {
      cleanupUser();
    });

    /**
     * Evento: Utente si è unito a una chiamata
     */
    socket.on("call:joined", ({ roomId, userId, role }) => {
      roomService.handleCallJoined(socket.id, roomId, { userId, role });
    });

    /**
     * Evento: Utente si disconnette
     */
    socket.on("disconnect", () => {
      console.log(`🔌 [DISCONN] Utente ${socket.id} disconnesso.`);
      cleanupUser();
    });
  });
};
