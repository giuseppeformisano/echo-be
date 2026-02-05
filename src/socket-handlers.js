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
     * Evento: Utente ha terminato la chiamata
     * Esegue il processing dei reward se la durata è >= 10 minuti
     */
    socket.on("call:ended", async ({ roomId, userId }) => {
      console.log(
        `🏁 [CALL:ENDED] Utente ${userId} ha terminato la chiamata in ${roomId}`
      );

      // Notifica l'altro utente della fine della chiamata
      socket.broadcast.to(roomId).emit("call:peer-ended", { userId });

      // La logica di processing dei reward avverrà automaticamente
      // quando la stanza diventa vuota (handleRoomExit -> deleteRoom)
    });

    /**
     * Evento: Feedback positivo dato allo sfogatore
     * Assegna +25 XP bonus all'ascoltatore
     */
    socket.on("feedback:given", async ({ listenerId, feedback }) => {
      console.log(
        `⭐ [FEEDBACK] Feedback ${feedback} ricevuto per listener ${listenerId}`
      );

      if (feedback === "positive") {
        const result = await rewardService.processFeedbackBonus(listenerId);
        socket.emit("feedback:processed", {
          success: result.success,
          message: result.message || result.reason,
        });
      } else {
        console.log(
          `ℹ️ [FEEDBACK] Feedback negativo - nessun bonus XP assegnato`
        );
        socket.emit("feedback:processed", {
          success: true,
          message: "Feedback registrato",
        });
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
