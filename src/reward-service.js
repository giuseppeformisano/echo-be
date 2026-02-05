/**
 * Servizio per la gestione dei reward e dei costi delle chiamate
 * Integra le funzioni RPC di Supabase per assegnare XP e scalare crediti
 */

const supabase = require("./supabaseClient");

const CALL_DURATION_THRESHOLD = 0; // 10 minuti in secondi

class RewardService {
  /**
   * Processa i reward e i costi al termine di una chiamata
   * @param {Object} callData - Dati della chiamata { venterId, listenerId, durationSeconds }
   * @returns {Promise<Object>} - Risultato del processing
   */
  async processCallRewards(callData) {
    const { venterId, listenerId, durationSeconds } = callData;

    // Validazione dei dati
    if (!venterId || !listenerId) {
      console.warn(
        "⚠️ [REWARD] Dati incompleti per il processing dei reward:",
        callData
      );
      return { success: false, reason: "Dati incompleti" };
    }

    // Controlla la soglia di 10 minuti
    if (durationSeconds < CALL_DURATION_THRESHOLD) {
      console.log(
        `⏱️ [REWARD] Chiamata troppo breve (${durationSeconds}s < ${CALL_DURATION_THRESHOLD}s). Nessun reward assegnato.`
      );
      return { success: false, reason: "Durata insufficiente" };
    }

    const durationMinutes = Math.floor(durationSeconds / 60);

    try {
      console.log(
        `💰 [REWARD] Inizio processing reward per: venter=${venterId}, listener=${listenerId}, durata=${durationMinutes}min`
      );

      // Esegui le due RPC in parallelo per atomicità
      const [venterResult, listenerResult] = await Promise.all([
        this.processVenterReward(venterId, durationMinutes),
        this.processListenerReward(listenerId, durationMinutes, false),
      ]);

      if (!venterResult.success || !listenerResult.success) {
        console.error(
          "❌ [REWARD] Errore nel processing dei reward:",
          venterResult,
          listenerResult
        );
        return {
          success: false,
          reason: "Errore nel processing RPC",
          details: { venterResult, listenerResult },
        };
      }

      console.log(
        `✅ [REWARD] Processing completato. Venter: ${venterResult.message}, Listener: ${listenerResult.message}`
      );

      return {
        success: true,
        venter: venterResult,
        listener: listenerResult,
      };
    } catch (error) {
      console.error("❌ [REWARD] Errore durante il processing dei reward:", error);
      return {
        success: false,
        reason: "Eccezione durante processing",
        error: error.message,
      };
    }
  }

  /**
   * Processa il reward dello sfogatore (venter)
   * Scala -1 credito e assegna +2 XP/minuto
   * @param {string} venterId - ID dello sfogatore
   * @param {number} durationMinutes - Durata della chiamata in minuti
   * @returns {Promise<Object>} - Risultato della RPC
   */
  async processVenterReward(venterId, durationMinutes) {
    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { data, error } = await supabase.rpc(
        "process_venter_end_call",
        {
          p_venter_id: venterId,
          p_duration_min: durationMinutes,
        }
      );

      if (error) {
        console.error(
          `❌ [VENTER] RPC error per ${venterId}:`,
          error.message
        );
        return { success: false, message: error.message };
      }

      console.log(
        `👤 [VENTER] Reward processato per ${venterId}: -1 credito, +${durationMinutes * 2} XP`
      );
      return {
        success: true,
        message: `Crediti scalati, ${durationMinutes * 2} XP assegnati`,
        data,
      };
    } catch (error) {
      console.error(
        `❌ [VENTER] Eccezione nel processing venter ${venterId}:`,
        error
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Processa il reward dell'ascoltatore (listener)
   * Assegna +5 XP/minuto e opzionalmente +25 XP bonus se feedback positivo
   * @param {string} listenerId - ID dell'ascoltatore
   * @param {number} durationMinutes - Durata della chiamata in minuti
   * @param {boolean} isPositive - Flag per feedback positivo
   * @returns {Promise<Object>} - Risultato della RPC
   */
  async processListenerReward(listenerId, durationMinutes, isPositive = false) {
    try {
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { data, error } = await supabase.rpc(
        "process_listener_end_call",
        {
          p_listener_id: listenerId,
          p_duration_min: isPositive ? 0 : durationMinutes,
          p_is_positive: isPositive,
        }
      );

      if (error) {
        console.error(
          `❌ [LISTENER] RPC error per ${listenerId}:`,
          error.message
        );
        return { success: false, message: error.message };
      }

      const xpAwarded = isPositive
        ? 25
        : durationMinutes * 5;

      console.log(
        `👤 [LISTENER] Reward processato per ${listenerId}: +${xpAwarded} XP ${
          isPositive ? "(bonus feedback positivo)" : ""
        }`
      );

      return {
        success: true,
        message: `${xpAwarded} XP assegnati ${
          isPositive ? "(bonus feedback)" : ""
        }`,
        data,
      };
    } catch (error) {
      console.error(
        `❌ [LISTENER] Eccezione nel processing listener ${listenerId}:`,
        error
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Processa il feedback positivo per l'ascoltatore
   * Assegna +25 XP bonus se lo sfogatore dà feedback positivo
   * @param {string} listenerId - ID dell'ascoltatore
   * @returns {Promise<Object>} - Risultato della RPC
   */
  async processFeedbackBonus(listenerId) {
    console.log(`⭐ [FEEDBACK] Elaborazione bonus feedback positivo per ${listenerId}`);
    return await this.processListenerReward(listenerId, 0, true);
  }
}

module.exports = new RewardService();
