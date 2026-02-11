/**
 * Gestione degli event handler Socket.IO
 */

const queueService = require("./queue-service");
const RoomService = require("./room-service");
const MatchingService = require("./matching-service");
const rewardService = require("./reward-service");

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
    socket.on("queue:join", ({ role, userId }) => {
      // Opzionalmente salva userId nel socket per riferimento futuro
      if (userId) {
        socket.userId = userId;
      }
      queueService.handleQueueJoin(
        socket,
        role,
        (user1, user2) => {
          matchingService.startMatch(user1, user2);
        },
        userId
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
     * Evento: Utente invia un feedback per l'ascoltatore
     */
    socket.on("call:submit_feedback", async (payload) => {
      const { roomId, empathy, presence, non_judgment, usefulness, comment } = payload || {};
      console.log(`⭐ [FEEDBACK] Ricevuto feedback per room ${roomId}`);

      try {
        const chatSessionService = require('./chat-session-service');

        const reviewResult = await chatSessionService.saveReview({
          roomId,
          empathy,
          presence,
          non_judgment,
          usefulness,
          comment: comment || null,
        });

        if (!reviewResult.success) {
          console.error(`❌ [FEEDBACK] Errore salvataggio review:`, reviewResult.error);
          return;
        }

        console.log(`✅ [FEEDBACK] Review salvata per room ${roomId}`);
      } catch (error) {
        console.error(`❌ [FEEDBACK] Errore:`, error);
      }
    });

    /**
     * Evento: Recupera le reviews di un listener
     */
    socket.on("get_listener_reviews", async ({ listenerId }, callback) => {
      try {
        const chatSessionService = require('./chat-session-service');
        const reviews = await chatSessionService.getListenerReviews(listenerId);
        
        if (callback) {
          callback({ success: true, reviews });
        }
      } catch (error) {
        console.error(`❌ [REVIEWS] Errore recupero reviews:`, error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
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
