const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5500;
const players = new Map();
const rooms = new Map();

function sanitizePlayerName(name) {
  return String(name || 'Player').trim().slice(0, 20) || 'Player';
}

function emitLobbyList() {
  const onlinePlayers = Array.from(players.values()).map((player) => ({
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

io.on('connection', (socket) => {
  socket.emit('server:ready', { message: 'Connected' });

  socket.on('player:join', ({ name }) => {
    const safeName = sanitizePlayerName(name);
    players.set(socket.id, {
      id: socket.id,
      name: safeName,
      team: null
    });
    socket.emit('player:session', { id: socket.id, name: safeName });
    emitLobbyList();
  });

  socket.on('player:challenge', ({ targetId, team }) => {
    const challenger = players.get(socket.id);
    const target = players.get(targetId);
    if (!challenger || !target || targetId === socket.id) return;

    const challengerTeam = team === 'dark' ? 'dark' : 'light';
    const targetTeam = challengerTeam === 'light' ? 'dark' : 'light';
    const roomId = `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    rooms.set(roomId, {
      roomId,
      state: 'waiting',
      currentTurn: socket.id,
      players: [
        { socketId: socket.id, name: challenger.name, team: challengerTeam },
        { socketId: targetId, name: target.name, team: targetTeam }
      ],
      challengerId: socket.id,
      challengerTeam,
      targetTeam
    });

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
  });

  socket.on('challenge:accept', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.state = 'active';
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
    const room = findRoomForSocket(socket.id);
    if (!room || room.currentTurn !== socket.id) return;

    const opponent = room.players.find((player) => player.socketId !== socket.id);
    if (!opponent) return;

    socket.to(opponent.socketId).emit('match:action', payload);
  });

  socket.on('match:end-turn', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.currentTurn !== socket.id) return;

    const nextPlayer = room.players.find((player) => player.socketId !== socket.id);
    if (!nextPlayer) return;

    room.currentTurn = nextPlayer.socketId;
    io.to(room.players.map((player) => player.socketId)).emit('match:turn', {
      roomId,
      currentTurnId: room.currentTurn
    });
  });

  socket.on('match:ended', ({ roomId, reason }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(room.players.map((player) => player.socketId)).emit('match:ended', { reason });
    rooms.delete(roomId);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);

    for (const [roomId, room] of rooms.entries()) {
      const playerInRoom = room.players.find((player) => player.socketId === socket.id);
      if (!playerInRoom) continue;

      const otherPlayers = room.players.filter((player) => player.socketId !== socket.id);
      if (otherPlayers.length > 0) {
        io.to(otherPlayers[0].socketId).emit('match:ended', {
          reason: 'opponent-left'
        });
      }

      rooms.delete(roomId);
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
