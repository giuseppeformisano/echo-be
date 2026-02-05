/**
 * Servizio per la gestione delle stanze e delle sessioni di chiamata
 */

const state = require("./state");
const dailyService = require("./daily-service");
const chatSessionService = require("./chat-session-service");
const rewardService = require("./reward-service");

class RoomService {
  /**
   * Gestisce l'evento di un utente che si unisce a una chiamata
   * @param {string} socketId - ID del socket
   * @param {string} roomId - ID della stanza
   * @param {Object} participantData - Dati del partecipante { userId, role }
   */
  handleCallJoined(socketId, roomId, participantData) {
    console.log(
      `📞 [CALL] Utente ${socketId} con userId ${participantData?.userId} si è unito alla chiamata ${roomId}`
    );

    // Inizializza sessione se non esiste
    if (!state.getCallSession(roomId)) {
      state.createCallSession(roomId);
      console.log(`🆕 [CALL] Nuova sessione creata per stanza ${roomId}`);
    }

    // Aggiungi i dati del partecipante
    if (participantData && participantData.userId) {
      state.addParticipantToSession(roomId, socketId, participantData);
      console.log(
        `👤 [CALL] Partecipante ${participantData.userId} (${participantData.role}) aggiunto`
      );
    }

    const session = state.getCallSession(roomId);
    const usersConnected = state.getUsersConnected(roomId);

    // Quando entrambi sono connessi, avvia il timer
    if (usersConnected === 2 && session.startTime === null) {
      session.startTime = Date.now();
      console.log(`⏱️ [CALL] Timer avviato per ${roomId}`);
    }

    console.log(
      `👥 [CALL] Utenti connessi in ${roomId}: ${usersConnected}`
    );
  }

  async handleRoomExit(socketId) {
    const roomId = state.getSocketRoom(socketId);
    if (!roomId) return;

    // Ottieni dati partecipante PRIMA di rimuovere
    const session = state.getCallSession(roomId);
    const participantData = state.getParticipantData(roomId, socketId);

    state.removeUserFromRoom(socketId, roomId);
    state.unmapSocket(socketId);

    console.log(`🚪 [ROOM] Utente ${socketId} uscito da ${roomId}`);

    if (session && session.startTime !== null) {
      const duration = Math.floor((Date.now() - session.startTime) / 1000);
      state.setCallDuration(roomId, duration);

      // Processa reward individuale se durata >= 10min
      if (participantData && duration >= 0) {
        const durationMinutes = Math.floor(duration / 60);
        console.log(`💰 [REWARD] Processing ${participantData.role} ${participantData.userId}`);
        
        if (participantData.role === 'venter') {
          await rewardService.processVenterReward(participantData.userId, 20);
        } else if (participantData.role === 'listener') {
          await rewardService.processListenerReward(participantData.userId, 20, false);
        }
      }
    }

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
      const participants = state.getSessionParticipants(roomId);
      if (participants?.venter && participants?.listener && session.callDuration) {
        const sessionData = {
          roomId: roomId,
          venterId: participants.venter.userId,
          listenerId: participants.listener.userId,
          durationSeconds: session.callDuration,
          startedAt: new Date(session.startTime).toISOString(),
          endedAt: new Date().toISOString(),
          completed: true,
        };

        // Salva su Supabase
        await chatSessionService.saveSession(sessionData);
        console.log(`💾 [CALL] Sessione salvata per stanza ${roomId}`);
      }

      state.deleteCallSession(roomId);
    }

    state.deleteRoom(roomId);
    await dailyService.deleteRoom(roomId);
  }
}

module.exports = RoomService;
