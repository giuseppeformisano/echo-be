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
   * Crea una nuova chat_session quando entrambi i partecipanti sono connessi
   * @param {Object} data - {roomId, venterId, listenerId}
   * @returns {Promise<Object>}
   */
  async createSession(data) {
    if (!this.supabase) return null;

    try {
      const { data: session, error } = await this.supabase
        .from("chat_sessions")
        .insert([{
          room_id: data.roomId,
          venter_id: data.venterId,
          listener_id: data.listenerId,
          started_at: new Date().toISOString(),
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;
      
      console.log(`✅ [DB] Chat session creata per room ${data.roomId}`);
      return session;
    } catch (error) {
      console.error(`❌ [DB] Errore creazione sessione:`, error.message);
      return null;
    }
  }

  /**
   * Aggiorna sessione quando il venter esce
   * @param {string} roomId
   * @param {number} duration - durata in secondi
   */
  async updateSessionOnVenterExit(roomId, duration) {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from("chat_sessions")
        .update({
          duration_seconds: duration,
          ended_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq("room_id", roomId);
      
      console.log(`✅ [DB] Sessione aggiornata (venter exit) per ${roomId}`);
    } catch (error) {
      console.error(`❌ [DB] Errore aggiornamento sessione:`, error);
    }
  }

  /**
   * Aggiorna sessione quando il listener esce
   * @param {string} roomId
   * @param {number} duration - durata in secondi
   */
  async updateSessionOnListenerExit(roomId, duration) {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from("chat_sessions")
        .update({
          duration_seconds: duration,
          ended_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq("room_id", roomId);
      
      console.log(`✅ [DB] Sessione aggiornata (listener exit) per ${roomId}`);
    } catch (error) {
      console.error(`❌ [DB] Errore aggiornamento sessione:`, error);
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
   * Recupera il listener_id da una sessione usando il room_id
   * @param {string} roomId - ID della stanza
   * @returns {Promise<string|null>} ID del listener o null
   */
  async getListenerIdByRoomId(roomId) {
    if (!this.supabase) {
      console.warn("⚠️ [WARN] Supabase client non inizializzato");
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .select("listener_id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error(`❌ [DB] Errore recupero listener per room ${roomId}:`, error.message);
        return null;
      }

      return data?.listener_id || null;
    } catch (error) {
      console.error(`❌ [DB] Eccezione recupero listener:`, error);
      return null;
    }
  }

  /**
   * Recupera una sessione completa tramite room_id
   * @param {string} roomId - ID della stanza
   * @returns {Promise<Object|null>} Dati della sessione
   */
  async getSessionByRoomId(roomId) {
    if (!this.supabase) {
      console.warn("⚠️ [WARN] Supabase client non inizializzato");
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from("chat_sessions")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error(`❌ [DB] Errore recupero sessione per room ${roomId}:`, error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`❌ [DB] Eccezione recupero sessione:`, error);
      return null;
    }
  }

  /**
   * Salva una review nella tabella reviews (nuovo schema)
   * @param {Object} reviewData - {roomId, score, tags, comment}
   * @returns {Promise<Object>}
   */
  async saveReview(reviewData) {
    if (!this.supabase) {
      return { success: false, error: "Supabase non inizializzato" };
    }
    try {
      // Recupera sessione per ricavare listener_id
      const session = await this.getSessionByRoomId(reviewData.roomId);
      const listenerId = session?.listener_id || null;

      const empathy = reviewData.empathy;
      const presence = reviewData.presence;
      const non_judgment = reviewData.non_judgment;
      const usefulness = reviewData.usefulness;

      const v_rating = (
        Number(empathy || 0) +
        Number(presence || 0) +
        Number(non_judgment || 0) +
        Number(usefulness || 0)
      ) / 4.0;

      const { data, error } = await this.supabase
        .from("reviews")
        .insert([
          {
            room_id: reviewData.roomId,
            empathy: empathy,
            presence: presence,
            non_judgment: non_judgment,
            usefulness: usefulness,
            tags: reviewData.tags || [],
            comment: reviewData.comment || null,
          },
        ])
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`✅ [DB] Review salvata per room ${reviewData.roomId}`);

      // Assegna eventuale bonus XP basato sul rating medio tramite rewardService
      try {
        if (listenerId) {
          const rewardService = require("./reward-service");
          await rewardService.processFeedbackBonus(listenerId, Number(v_rating));
          console.log(`✅ [FEEDBACK] Elaborato bonus per listener ${listenerId} (avg=${v_rating})`);
        }
      } catch (err) {
        console.error(`❌ [FEEDBACK] Errore assegnazione bonus:`, err);
      }

      return { success: true, data, v_rating };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Recupera le reviews di un listener tramite room_id dalle sue sessioni
   * @param {string} listenerId - ID del listener
   * @param {number} limit - Numero massimo di reviews da recuperare
   * @returns {Promise<Array>} Array di reviews
   */
  async getListenerReviews(listenerId, limit = 10) {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from("reviews")
        .select("*")
        .eq("listener_id", listenerId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`❌ [DB] Errore recupero reviews:`, error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`❌ [DB] Eccezione recupero reviews:`, error);
      return [];
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
