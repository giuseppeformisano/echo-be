/**
 * Servizio per il salvataggio delle sessioni di chat su Supabase
 * Utilizza il Supabase Client isolato per gestire le operazioni database
 */

const supabase = require("./supabaseClient");

class ChatSessionService {
  constructor() {
    this.supabase = supabase;

    if (!this.supabase) {
      console.warn(
        "⚠️ [WARN] Supabase client non inizializzato. Le sessioni non verranno salvate."
      );
    }
  }

  /**
   * Salva una sessione di chat su Supabase
   * @param {Object} sessionData - Dati della sessione
   * @returns {Promise<Object>} Risposta da Supabase
   */
  async saveSession(sessionData) {
    if (!this.supabase) {
      console.warn(
        "⚠️ [WARN] Impossibile salvare sessione: Supabase client non inizializzato"
      );
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .insert([
          {
            room_id: sessionData.roomId,
            venter_id: sessionData.venterId,
            listener_id: sessionData.listenerId,
            duration_seconds: sessionData.durationSeconds,
            started_at: sessionData.startedAt,
            ended_at: sessionData.endedAt,
            venter_xp_earned: sessionData.venterXpEarned || 0,
            listener_xp_earned: sessionData.listenerXpEarned || 0,
            completed: sessionData.completed || true,
            notes: sessionData.notes || null,
          },
        ]);

      if (error) {
        throw error;
      }

      console.log(
        `✅ [DB] Sessione ${sessionData.roomId} salvata su Supabase`
      );
      return data;
    } catch (error) {
      console.error(
        `❌ [DB] Errore salvataggio sessione ${sessionData.roomId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Recupera le sessioni di un utente
   * @param {string} userId - ID utente
   * @returns {Promise<Array>} Array di sessioni
   */
  async getUserSessions(userId) {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .select("*")
        .or(`venter_id.eq.${userId},listener_id.eq.${userId}`)
        .order("ended_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error(
        `❌ [DB] Errore recupero sessioni per ${userId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Aggiorna una sessione esistente
   * @param {string} roomId - ID della stanza
   * @param {Object} updates - Dati da aggiornare
   * @returns {Promise<Object>} Risposta da Supabase
   */
  async updateSession(roomId, updates) {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .update(updates)
        .eq("room_id", roomId);

      if (error) {
        throw error;
      }

      console.log(`✅ [DB] Sessione ${roomId} aggiornata su Supabase`);
      return data;
    } catch (error) {
      console.error(
        `❌ [DB] Errore aggiornamento sessione ${roomId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Recupera una sessione specifica
   * @param {string} roomId - ID della stanza
   * @returns {Promise<Object|null>} Dati della sessione o null
   */
  async getSession(roomId) {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .select("*")
        .eq("room_id", roomId)
        .single();

      if (error) {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error(
        `❌ [DB] Errore recupero sessione ${roomId}:`,
        error.message
      );
      return null;
    }
  }
}

module.exports = new ChatSessionService();
