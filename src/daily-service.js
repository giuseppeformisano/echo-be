/**
 * Servizio per l'interazione con l'API Daily.co
 */

const axios = require("axios");
const config = require("./config");

class DailyService {
  constructor() {
    this.apiKey = config.DAILY_API_KEY;
    this.baseUrl = config.dailyApi.baseUrl;
    this.roomExpirySeconds = config.dailyApi.roomExpirySeconds;

    if (!this.apiKey) {
      console.warn(
        "⚠️ [WARN] Daily.co API Key MANCANTE! Le stanze non verranno create."
      );
    }
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Crea una nuova stanza Daily.co
   * @returns {Promise<Object>} Room data con url e name
   */
  async createRoom() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/rooms`,
        {
          properties: {
            exp: Math.round(Date.now() / 1000) + this.roomExpirySeconds,
          },
        },
        {
          headers: this.getHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      console.error("❌ [DAILY] Errore creazione stanza:", error.message);
      throw error;
    }
  }

  /**
   * Elimina una stanza Daily.co
   * @param {string} roomId - ID della stanza
   */
  async deleteRoom(roomId) {
    try {
      await axios.delete(`${this.baseUrl}/rooms/${roomId}`, {
        headers: this.getHeaders(),
      });
      console.log(`✅ [DAILY] Stanza ${roomId} eliminata.`);
    } catch (error) {
      console.error(
        `❌ [DAILY] Errore eliminazione stanza ${roomId}:`,
        error.message
      );
    }
  }

  /**
   * Verifica se l'API Key è configurata
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = new DailyService();
