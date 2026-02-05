/**
 * Servizio per la gestione delle stanze e delle sessioni di chiamata
 */

const state = require("./state");
const dailyService = require("./daily-service");
const chatSessionService = require("./chat-session-service");

class RoomService {
  /**
   * Gestisce l'evento di un utente che si unisce a una chiamata
   * @param {string} socketId - ID del socket
   * @param {string} roomId - ID della stanza
   * @param {Object} participantData - Dati del partecipante { userId, role }
   */
  handleCallJoined(socketId, roomId, participantData) {
    console.log(
      `📞 [CALL] Utente ${socketId} si è unito alla chiamata ${roomId}`
    );

    // Traccia i dati del partecipante nella sessione
    if (participantData && participantData.userId) {
      state.addParticipantToSession(roomId, socketId, participantData);
      console.log(
        `👤 [CALL] Partecipante ${participantData.userId} (${participantData.role}) aggiunto`
      );
    }

    // Inizializza o aggiorna la sessione di chiamata
    if (!state.getCallSession(roomId)) {
      state.createCallSession(roomId);
      console.log(`🆕 [CALL] Nuova sessione creata per stanza ${roomId}`);
    }

    const session = state.getCallSession(roomId);
    const usersConnected = state.getUsersConnected(roomId);

    // Salva i dati del venter e del listener
    if (participantData) {
      if (participantData.role === "venter") {
        session.venterId = participantData.userId;
      } else if (participantData.role === "listener") {
        session.listenerId = participantData.userId;
      }
    }

    // Se è il secondo utente, inizia a tracciare il tempo
    if (usersConnected === 2 && session.startTime === null) {
      session.startTime = Date.now();
      console.log(`⏱️ [CALL] Timer avviato per stanza ${roomId}`);
    }

    console.log(
      `👥 [CALL] Utenti connessi in ${roomId}: ${usersConnected}`
    );
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
      const usersConnected = state.getUsersConnected(roomId);

      // Se ci sono ancora utenti connessi, calcola la durata
      if (usersConnected > 0 && session.startTime !== null) {
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        state.setCallDuration(roomId, duration);
        console.log(`⏱️ [CALL] Durata chiamata ${roomId}: ${duration}s`);
      }

      console.log(
        `👥 [CALL] Utenti rimanenti in ${roomId}: ${usersConnected}`
      );
    }

    // Se la stanza è vuota, eliminala
    if (state.isRoomEmpty(roomId)) {
      await this.deleteRoom(roomId);
    }
  }

  /**
   * Elimina una stanza e la relativa sessione di chiamata, salvando i dati su Supabase
   * @param {string} roomId - ID della stanza
   */
  async deleteRoom(roomId) {
    console.log(`🧹 [ROOM] Stanza ${roomId} vuota. Eliminazione...`);

    // Salva la sessione su Supabase prima di eliminare
    const session = state.getCallSession(roomId);
    if (session) {
      if (session.startTime !== null) {
        const duration = Math.floor((Date.now() - session.startTime) / 1000);
        state.setCallDuration(roomId, duration);
        console.log(
          `📊 [CALL] Sessione ${roomId} terminata. Durata totale: ${duration}s`
        );
      }

      // Prepara i dati per il salvataggio
      if (session.venterId && session.listenerId && session.callDuration) {
        const sessionData = {
          roomId: roomId,
          venterId: session.venterId,
          listenerId: session.listenerId,
          durationSeconds: session.callDuration,
          startedAt: new Date(session.startTime).toISOString(),
          endedAt: new Date().toISOString(),
          completed: true,
        };

        // Salva su Supabase
        await chatSessionService.saveSession(sessionData);
      }

      state.deleteCallSession(roomId);
    }

    state.deleteRoom(roomId);
    await dailyService.deleteRoom(roomId);
  }
}

module.exports = RoomService;
