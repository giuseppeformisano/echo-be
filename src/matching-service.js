/**
 * Servizio per la logica di matching e creazione delle stanze
 */

const state = require("./state");
const dailyService = require("./daily-service");

class MatchingService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Avvia un match tra due utenti
   * @param {Object} user1 - Socket del primo utente (venter)
   * @param {Object} user2 - Socket del secondo utente (listener)
   */
  async startMatch(user1, user2) {
    console.log(`✨ [MATCH] Trovato: ${user1.id} <-> ${user2.id}`);

    try {
      const roomData = await dailyService.createRoom();
      const matchPayload = { url: roomData.url, roomId: roomData.name };

      // Notifica entrambi gli utenti
      this.io.to(user1.id).emit("match:found", matchPayload);
      this.io.to(user2.id).emit("match:found", matchPayload);

      console.log("✅ [MATCH] Stanze assegnate e utenti notificati.");
    } catch (err) {
      // Notifica errore ai client se la creazione stanza fallisce
      const errorMsg = {
        message: "Errore tecnico nella creazione della stanza",
      };
      user1.emit("match:error", errorMsg);
      user2.emit("match:error", errorMsg);
    }
  }
}

module.exports = MatchingService;
