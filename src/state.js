/**
 * Gestione dello stato centralizzato dell'applicazione
 */

class AppState {
  constructor() {
    this.venters = []; // Coda Sfogatori
    this.listeners = []; // Coda Ascoltatori
    this.activeRooms = new Map(); // roomId -> Set<socketId>
    this.socketRoomMap = new Map(); // socketId -> roomId
    this.callSessions = new Map(); // roomId -> { usersConnected, callDuration, startTime }
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
    this.activeRooms.set(roomId, participants);
  }

  deleteRoom(roomId) {
    this.activeRooms.delete(roomId);
  }

  getRoom(roomId) {
    return this.activeRooms.get(roomId);
  }

  mapSocketToRoom(socketId, roomId) {
    this.socketRoomMap.set(socketId, roomId);
  }

  unmapSocket(socketId) {
    this.socketRoomMap.delete(socketId);
  }

  getSocketRoom(socketId) {
    return this.socketRoomMap.get(socketId);
  }

  removeUserFromRoom(socketId, roomId) {
    const participants = this.activeRooms.get(roomId);
    if (participants) {
      participants.delete(socketId);
    }
  }

  getRoomParticipantCount(roomId) {
    const participants = this.activeRooms.get(roomId);
    return participants ? participants.size : 0;
  }

  // --- Call Session Management ---
  createCallSession(roomId) {
    this.callSessions.set(roomId, {
      usersConnected: 1,
      callDuration: null,
      startTime: null,
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
    const participants = this.activeRooms.get(roomId);
    return !participants || participants.size === 0;
  }
}

module.exports = new AppState();
