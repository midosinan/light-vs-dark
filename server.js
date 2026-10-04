const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5501;
const WAITING_ROOM_TIMEOUT_MS = 2 * 60 * 1000;
const RECONNECT_GRACE_MS = 30 * 1000;
const players = new Map();
const rooms = new Map();

function sanitizePlayerName(name) {
  return String(name || 'Player').trim().slice(0, 20) || 'Player';
}

function emitLobbyList() {
  const onlinePlayers = Array.from(players.values()).filter((player) => !findRoomForSession(player.sessionId)).map((player) => ({
    id: player.id,
    name: player.name,
    team: player.team || null
  }));

  io.emit('lobby:list', onlinePlayers);
}

function findRoomForSocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.socketId === socketId)) {
      return room;
    }
  }
  return null;
}

function findRoomForSession(sessionId) {
  if (!sessionId) return null;
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.sessionId === sessionId)) return room;
  }
  return null;
}

function emitRoomEnded(room, reason) {
  clearRoomTimers(room);
  room.players.forEach((player) => {
    if (player.socketId) io.to(player.socketId).emit('match:ended', { reason });
  });
  rooms.delete(room.roomId);
}

function scheduleWaitingRoomExpiry(room) {
  room.waitingTimer = setTimeout(() => {
    if (rooms.get(room.roomId) !== room || room.state !== 'waiting') return;
    emitRoomEnded(room, 'challenge-expired');
    emitLobbyList();
  }, WAITING_ROOM_TIMEOUT_MS);
}

function clearRoomTimers(room) {
  if (room.waitingTimer) clearTimeout(room.waitingTimer);
  if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
  room.waitingTimer = null;
  room.reconnectTimer = null;
}

function getRoomPlayer(room, socketId) {
  return room?.players.find((player) => player.socketId === socketId) || null;
}

function isRoomMember(room, socketId) {
  return Boolean(getRoomPlayer(room, socketId));
}

function roomIsFullyConnected(room) {
  return room.players.every((player) => player.socketId && players.has(player.socketId));
}

function emitRoomTurn(room) {
  if (room.state !== 'active' || !roomIsFullyConnected(room)) return;
  io.to(room.players.map((player) => player.socketId)).emit('match:turn', {
    roomId: room.roomId,
    currentTurnId: room.currentTurn
  });
}

function roomSummary(room) {
  return {
    roomId: room.roomId,
    players: room.players.map((player) => ({
      id: player.socketId || player.sessionId,
      name: player.name,
      team: player.team
    })),
    currentTurnId: room.currentTurn,
    state: room.state
  };
}

io.on('connection', (socket) => {
  socket.emit('server:ready', { message: 'Connected' });

  socket.on('player:join', ({ name, sessionId: requestedSessionId } = {}) => {
    const safeName = sanitizePlayerName(name);
    const previousRoom = findRoomForSession(requestedSessionId);
    const sessionId = previousRoom
      ? requestedSessionId
      : crypto.randomBytes(18).toString('hex');
    const previousPlayer = previousRoom?.players.find((player) => player.sessionId === sessionId);
    const previousSocketId = previousPlayer?.socketId;
    const player = {
      id: socket.id,
      sessionId,
      name: previousPlayer?.name || safeName,
      team: previousPlayer?.team || null
    };
    players.set(socket.id, player);

    if (previousPlayer) {
      previousPlayer.socketId = socket.id;
      previousPlayer.disconnectedAt = null;
      if (previousRoom.currentTurn === previousSocketId) previousRoom.currentTurn = socket.id;
      previousRoom.state = roomIsFullyConnected(previousRoom) ? 'active' : 'paused';
      if (previousRoom.state === 'active') clearRoomTimers(previousRoom);
      socket.emit('match:resume', roomSummary(previousRoom));
      previousRoom.players.forEach((roomPlayer) => {
        if (roomPlayer.socketId && roomPlayer.socketId !== socket.id) {
          io.to(roomPlayer.socketId).emit('match:resumed', roomSummary(previousRoom));
        }
      });
      emitRoomTurn(previousRoom);
    } else if (requestedSessionId) {
      socket.emit('match:resume-failed', { reason: 'match-ended' });
    }

    socket.emit('player:session', { id: socket.id, name: player.name, sessionId });
    emitLobbyList();
  });

  socket.on('player:challenge', ({ targetId, team }) => {
    const challenger = players.get(socket.id);
    const target = players.get(targetId);
    if (!challenger || !target || targetId === socket.id) return;
    if (findRoomForSession(challenger.sessionId) || findRoomForSession(target.sessionId)) {
      socket.emit('challenge:error', { message: 'أحد اللاعبين موجود بالفعل في تحدٍ آخر.' });
      return;
    }

    const challengerTeam = team === 'dark' ? 'dark' : 'light';
    const targetTeam = challengerTeam === 'light' ? 'dark' : 'light';
    const roomId = `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    rooms.set(roomId, {
      roomId,
      state: 'waiting',
      currentTurn: socket.id,
      players: [
        { socketId: socket.id, sessionId: challenger.sessionId, name: challenger.name, team: challengerTeam },
        { socketId: targetId, sessionId: target.sessionId, name: target.name, team: targetTeam }
      ],
      challengerId: socket.id,
      challengerTeam,
      targetTeam,
      waitingTimer: null,
      reconnectTimer: null
    });
    scheduleWaitingRoomExpiry(rooms.get(roomId));

    socket.to(targetId).emit('challenge:incoming', {
      roomId,
      challengerId: socket.id,
      challengerName: challenger.name,
      challengerTeam,
      targetTeam,
      forcedTeam: targetTeam
    });

    socket.emit('challenge:sent', {
      roomId,
      targetId,
      targetName: target.name,
      selectedTeam: challengerTeam
    });
    emitLobbyList();
  });

  socket.on('challenge:accept', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'waiting') return;
    const target = room.players.find((player) => player.socketId === socket.id);
    if (!target || !room.players.every((player) => player.socketId && players.has(player.socketId))) return;

    room.state = 'active';
    clearRoomTimers(room);
    const roomPlayers = room.players.map((player) => ({
      id: player.socketId,
      name: player.name,
      team: player.team
    }));

    io.to(room.players.map((player) => player.socketId)).emit('match:start', {
      roomId,
      mode: 'online',
      currentTurnId: room.currentTurn,
      players: roomPlayers
    });
  });

  socket.on('match:action', (payload) => {
    const room = rooms.get(payload?.roomId);
    if (!room || room.state !== 'active' || !roomIsFullyConnected(room) || !isRoomMember(room, socket.id) || room.currentTurn !== socket.id) return;

    const opponent = room.players.find((player) => player.socketId !== socket.id);
    if (!opponent) return;

    socket.to(opponent.socketId).emit('match:action', payload);
  });

  socket.on('match:end-turn', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'active' || !roomIsFullyConnected(room) || !isRoomMember(room, socket.id) || room.currentTurn !== socket.id) return;

    const nextPlayer = room.players.find((player) => player.socketId !== socket.id);
    if (!nextPlayer) return;

    room.currentTurn = nextPlayer.socketId;
    emitRoomTurn(room);
  });

  socket.on('match:ended', ({ roomId, reason }) => {
    const room = rooms.get(roomId);
    if (!room || !isRoomMember(room, socket.id)) return;
    clearRoomTimers(room);
    emitRoomEnded(room, reason === 'finished' ? 'finished' : 'opponent-left');
    emitLobbyList();
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);

    for (const [roomId, room] of rooms.entries()) {
      const playerInRoom = room.players.find((player) => player.socketId === socket.id);
      if (!playerInRoom) continue;
      playerInRoom.socketId = null;
      playerInRoom.disconnectedAt = Date.now();

      if (room.state === 'waiting') {
        emitRoomEnded(room, 'opponent-left');
        continue;
      }

      room.state = 'paused';
      const otherPlayers = room.players.filter((player) => player.socketId);
      otherPlayers.forEach((player) => io.to(player.socketId).emit('match:paused', { roomId, graceMs: RECONNECT_GRACE_MS }));
      room.reconnectTimer = setTimeout(() => {
        if (rooms.get(roomId) !== room || room.state !== 'paused') return;
        emitRoomEnded(room, 'opponent-left');
        emitLobbyList();
      }, RECONNECT_GRACE_MS);
    }

    emitLobbyList();
  });
});

app.use(express.static(path.join(__dirname)));
app.get('/health', (req, res) => {
  res.json({ ok: true, onlinePlayers: players.size });
});

server.listen(PORT, () => {
  console.log(`Game server listening on http://localhost:${PORT}`);
});
