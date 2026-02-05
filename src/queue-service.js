/**
 * Servizio per la gestione delle code (Venters e Listeners)
 */

const state = require("./state");

class QueueService {
  /**
   * Gestisce il join di un utente alla coda
   * @param {Object} socket - Socket.IO socket
   * @param {string} role - "venter" o "listener"
   * @param {Function} onMatchFound - Callback quando viene trovato un match
   */
  handleQueueJoin(socket, role, onMatchFound) {
    console.log(
      `🔍 [QUEUE] Utente ${socket.id} cerca match come ${role}...`
    );

    if (role === "venter") {
      if (state.hasListeners()) {
        const partner = state.getListener();
        onMatchFound(socket, partner);
      } else {
        state.addVenter(socket);
        socket.emit("queue:searching");
        console.log(`⏳ [QUEUE] Venter ${socket.id} in attesa.`);
      }
    } else if (role === "listener") {
      if (state.hasVenters()) {
        const partner = state.getVenter();
        onMatchFound(partner, socket);
      } else {
        state.addListener(socket);
        socket.emit("queue:searching");
        console.log(`⏳ [QUEUE] Listener ${socket.id} in attesa.`);
      }
    }
  }

  /**
   * Rimuove un utente dalle code
   * @param {string} socketId - ID del socket
   */
  handleQueueLeave(socketId) {
    const isVenter = state.removeVenter(socketId);
    const isListener = state.removeListener(socketId);

    if (isVenter) {
      console.log(`🚶 [QUEUE] Venter ${socketId} rimosso dalla coda.`);
    }
    if (isListener) {
      console.log(`🚶 [QUEUE] Listener ${socketId} rimosso dalla coda.`);
    }

    return isVenter || isListener;
  }
}

module.exports = new QueueService();
