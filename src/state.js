/**
 * Gestione dello stato centralizzato dell'applicazione
 * Ottimizzato per ridurre ridondanze e centralizzare lo stato delle chiamate
 */

class AppState {
  constructor() {
    this.venters = []; // Coda Sfogatori
    this.listeners = []; // Coda Ascoltatori
    // Stato unificato delle stanze/sessioni - UNICA FONTE DI VERITÀ
    this.callSessions = new Map(); // roomId -> { participants, callDuration, startTime, venterId, listenerId }
  }

  // --- Queue Management ---
  addVenter(socket) {
    this.venters.push(socket);
  }

  removeVenter(socketId) {
    const index = this.venters.findIndex((s) => s.id === socketId);
    if (index > -1) {
      this.venters.splice(index, 1);
      return true;
    }
    return false;
  }

  getVenter() {
    return this.venters.shift();
  }

  addListener(socket) {
    this.listeners.push(socket);
  }

  removeListener(socketId) {
    const index = this.listeners.findIndex((s) => s.id === socketId);
    if (index > -1) {
      this.listeners.splice(index, 1);
      return true;
    }
    return false;
  }

  getListener() {
    return this.listeners.shift();
  }

  hasVenters() {
    return this.venters.length > 0;
  }

  hasListeners() {
    return this.listeners.length > 0;
  }

  // --- Room Management (Unificato con Call Sessions) ---
  createRoom(roomId, participants) {
    // Ora crea direttamente la callSession con i partecipanti
    const participantsMap = new Map();
    participants.forEach((socketId) => {
      participantsMap.set(socketId, { userId: null, role: null, joinTime: Date.now() });
    });

    this.callSessions.set(roomId, {
      participants: participantsMap,
      callDuration: null,
      startTime: null,
      venterId: null,
      listenerId: null,
    });
  }

  deleteRoom(roomId) {
    this.callSessions.delete(roomId);
  }

  getRoom(roomId) {
    const session = this.callSessions.get(roomId);
    if (!session) return null;
    // Ritorna un Set di socketIds per compatibilità
    return new Set(session.participants.keys());
  }

  mapSocketToRoom(socketId, roomId) {
    // Non più necessaria una mappa separata - ricaviamo dal participants
    const session = this.callSessions.get(roomId);
    if (session && !session.participants.has(socketId)) {
      session.participants.set(socketId, { userId: null, role: null, joinTime: Date.now() });
    }
  }

  unmapSocket(socketId) {
    // Trova la stanza del socket e rimuovilo dai participants
    for (const [roomId, session] of this.callSessions.entries()) {
      if (session.participants.has(socketId)) {
        session.participants.delete(socketId);
        return;
      }
    }
  }

  // === Call Session Management (Unificato) ===
  createCallSession(roomId) {
    // Se la sessione già esiste (creata da createRoom), aggiorna solo i metadati
    if (!this.callSessions.has(roomId)) {
      this.callSessions.set(roomId, {
        participants: new Map(),
        callDuration: null,
        startTime: null,
        venterId: null,
        listenerId: null,
      });
    }
  }

  updateCallSession(roomId, startTime = null) {
    const session = this.callSessions.get(roomId);
    if (session) {
      if (startTime !== null) {
        session.startTime = startTime;
      }
    }
  }

  getUsersConnected(roomId) {
    const session = this.callSessions.get(roomId);
    return session?.participants?.size || 0;
  }

  removeUserFromRoom(socketId, roomId) {
    const session = this.callSessions.get(roomId);
    if (session && session.participants) {
      session.participants.delete(socketId);
    }
  }

  getRoomParticipantCount(roomId) {
    const session = this.callSessions.get(roomId);
    return session?.participants?.size || 0;
  }

  // --- Call Session Management ---
  createCallSession(roomId) {
    this.callSessions.set(roomId, {
      usersConnected: 1,
      callDuration: null,
      startTime: null,
      venterId: null,
      listenerId: null,
      participants: new Map(), // socketId -> { userId, role, joinTime }
    });
  }

  updateCallSession(roomId, usersConnected, startTime = null) {
    const session = this.callSessions.get(roomId);
    if (session) {
      session.usersConnected = usersConnected;
      if (startTime !== null) {
        session.startTime = startTime;
      }
    }
  }

  getCallSession(roomId) {
    return this.callSessions.get(roomId);
  }

  deleteCallSession(roomId) {
    this.callSessions.delete(roomId);
  }

  setCallDuration(roomId, duration) {
    const session = this.callSessions.get(roomId);
    if (session) {
      session.callDuration = duration;
    }
  }

  isRoomEmpty(roomId) {
    const session = this.callSessions.get(roomId);
    return !session || !session.participants || session.participants.size === 0;
  }

  // --- Participant Information ---
  addParticipantToSession(roomId, socketId, participantData) {
    const session = this.callSessions.get(roomId);
    if (session) {
      session.participants.set(socketId, {
        userId: participantData.userId,
        role: participantData.role, // "venter" or "listener"
        joinTime: Date.now(),
      });

      if (participantData.role === "venter") {
        session.venterId = participantData.userId;
      } else if (participantData.role === "listener") {
        session.listenerId = participantData.userId;
      }
    }
  }

  getParticipantData(roomId, socketId) {
    const session = this.callSessions.get(roomId);
    if (session && session.participants.has(socketId)) {
      return session.participants.get(socketId);
    }
    return null;
  }

  getSessionParticipants(roomId) {
    const session = this.callSessions.get(roomId);
    if (session) {
      return {
        venterId: session.venterId,
        listenerId: session.listenerId,
        participants: session.participants,
      };
    }
    return null;
  }
}

module.exports = new AppState();
