/**
 * Servizio per la gestione delle stanze e delle sessioni di chiamata
 */

const state = require("./state");
const dailyService = require("./daily-service");

class RoomService {
  /**
   * Gestisce l'evento di un utente che si unisce a una chiamata
   * @param {string} socketId - ID del socket
   * @param {string} roomId - ID della stanza
   */
  handleCallJoined(socketId, roomId) {
    console.log(
      `📞 [CALL] Utente ${socketId} si è unito alla chiamata ${roomId}`
    );

    // Inizializza o aggiorna la sessione di chiamata
    if (!state.getCallSession(roomId)) {
      state.createCallSession(roomId);
      console.log(`🆕 [CALL] Nuova sessione creata per stanza ${roomId}`);
    } else {
      const session = state.getCallSession(roomId);
      session.usersConnected += 1;

      // Se è il secondo utente, inizia a tracciare il tempo
      if (session.usersConnected === 2 && session.startTime === null) {
        session.startTime = Date.now();
        console.log(`⏱️ [CALL] Timer avviato per stanza ${roomId}`);
      }

      console.log(
        `👥 [CALL] Utenti connessi in ${roomId}: ${session.usersConnected}`
      );
    }
  }

  /**
   * Gestisce l'uscita di un utente da una stanza
   * @param {string} socketId - ID del socket
   */
  async handleRoomExit(socketId) {
    const roomId = state.getSocketRoom(socketId);

    if (!roomId) {
      return;
    }

    state.removeUserFromRoom(socketId, roomId);
    state.unmapSocket(socketId);

    console.log(
      `🚪 [ROOM] Utente ${socketId} uscito dalla stanza ${roomId}`
    );

    // Aggiorna la sessione di chiamata
    const session = state.getCallSession(roomId);
    if (session) {
      session.usersConnected -= 1;

      // Se ci sono ancora utenti connessi, calcola la durata
      if (session.usersConnected > 0 && session.startTime !== null) {
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        state.setCallDuration(roomId, duration);
        console.log(`⏱️ [CALL] Durata chiamata ${roomId}: ${duration}s`);
      }

      console.log(
        `👥 [CALL] Utenti rimanenti in ${roomId}: ${session.usersConnected}`
      );
    }

    // Se la stanza è vuota, eliminala
    if (state.isRoomEmpty(roomId)) {
      await this.deleteRoom(roomId);
    }
  }

  /**
   * Elimina una stanza e la relativa sessione di chiamata
   * @param {string} roomId - ID della stanza
   */
  async deleteRoom(roomId) {
    console.log(`🧹 [ROOM] Stanza ${roomId} vuota. Eliminazione...`);

    // Rimuovi la sessione di chiamata
    const session = state.getCallSession(roomId);
    if (session) {
      if (session.startTime !== null) {
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        state.setCallDuration(roomId, duration);
        console.log(
          `📊 [CALL] Sessione ${roomId} terminata. Durata totale: ${duration}s`
        );
      }
      state.deleteCallSession(roomId);
    }

    state.deleteRoom(roomId);
    await dailyService.deleteRoom(roomId);
  }
}

module.exports = RoomService;
