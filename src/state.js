/**
 * Gestione dello stato centralizzato dell'applicazione
 * Ottimizzato per ridurre ridondanze e centralizzare lo stato delle chiamate
 */

class AppState {
  constructor() {
    this.venters = []; // Coda Sfogatori
    this.listeners = []; // Coda Ascoltatori
    // roomId -> { participants: Map(socketId -> {userId, role}), callDuration, startTime }
    this.callSessions = new Map();
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

  // --- Room Management ---
  createRoom(roomId, participants) {
    const participantsMap = new Map();
    participants.forEach((socketId) => {
      participantsMap.set(socketId, { userId: null, role: null });
    });

    this.callSessions.set(roomId, {
      participants: participantsMap,
      callDuration: null,
      startTime: null,
    });
  }

  deleteRoom(roomId) {
    this.callSessions.delete(roomId);
  }

  getRoom(roomId) {
    const session = this.callSessions.get(roomId);
    return session ? new Set(session.participants.keys()) : null;
  }

  mapSocketToRoom(socketId, roomId) {
    const session = this.callSessions.get(roomId);
    if (session && !session.participants.has(socketId)) {
      session.participants.set(socketId, { userId: null, role: null });
    }
  }

  unmapSocket(socketId) {
    for (const [roomId, session] of this.callSessions.entries()) {
      if (session.participants.has(socketId)) {
        session.participants.delete(socketId);
        return roomId;
      }
    }
  }

  // --- Call Session Management ---
  createCallSession(roomId) {
    if (!this.callSessions.has(roomId)) {
      this.callSessions.set(roomId, {
        participants: new Map(),
        callDuration: null,
        startTime: null,
      });
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

  getUsersConnected(roomId) {
    const session = this.callSessions.get(roomId);
    return session?.participants?.size || 0;
  }

  removeUserFromRoom(socketId, roomId) {
    const session = this.callSessions.get(roomId);
    if (session) {
      session.participants.delete(socketId);
    }
  }

  isRoomEmpty(roomId) {
    const session = this.callSessions.get(roomId);
    return !session || session.participants.size === 0;
  }

  // --- Participant Information ---
  addParticipantToSession(roomId, socketId, participantData) {
    const session = this.callSessions.get(roomId);
    if (session) {
      session.participants.set(socketId, {
        userId: participantData.userId,
        role: participantData.role,
      });
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
    if (!session) return null;
    
    const participants = {};
    for (const [socketId, data] of session.participants.entries()) {
      participants[data.role] = { socketId, ...data };
    }
    return participants;
  }

  getSocketRoom(socketId) {
    for (const [roomId, session] of this.callSessions.entries()) {
      if (session.participants.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }
}

module.exports = new AppState();
