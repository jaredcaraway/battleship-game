'use strict';

const jwt = require('jsonwebtoken');
const GameRoom = require('../game/GameRoom');
const queries = require('../db/queries');

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
const rooms = new Map();           // roomId → GameRoom
const matchmakingQueue = [];       // [{ socketId, userId }]
const disconnectTimers = new Map();// socketId → setTimeout handle
const socketToRoom = new Map();    // socketId → roomId
const userToSocket = new Map();    // userId  → socketId (for reconnection)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getUserFromSocket(socket) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

async function saveGameResult(room) {
  try {
    await queries.saveGame(room.getStats());
  } catch (err) {
    console.error('[saveGameResult] Failed to save game result:', err);
  }
}

// ---------------------------------------------------------------------------
// setupSocketHandlers(io)
// ---------------------------------------------------------------------------

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = getUserFromSocket(socket);
    const userId = user ? user.id : null;

    // Track userId → socketId for reconnection support
    if (userId) {
      userToSocket.set(userId, socket.id);
    }

    // ------------------------------------------------------------------
    // create-ai-game  { difficulty }
    // ------------------------------------------------------------------
    socket.on('create-ai-game', ({ difficulty } = {}) => {
      const mode = `ai_${difficulty || 'medium'}`;
      const roomId = generateRoomCode();

      const room = new GameRoom(roomId, mode);
      room.addPlayer(socket.id, userId);
      room.setupAI();

      rooms.set(roomId, room);
      socketToRoom.set(socket.id, roomId);

      socket.join(roomId);
      socket.emit('game-created', { roomId, mode });
    });

    // ------------------------------------------------------------------
    // create-room  — private PvP room
    // ------------------------------------------------------------------
    socket.on('create-room', () => {
      const roomId = generateRoomCode();
      const room = new GameRoom(roomId, 'pvp');
      room.addPlayer(socket.id, userId);

      rooms.set(roomId, room);
      socketToRoom.set(socket.id, roomId);

      socket.join(roomId);
      socket.emit('room-created', { roomId });
    });

    // ------------------------------------------------------------------
    // join-room  { roomId }
    // ------------------------------------------------------------------
    socket.on('join-room', ({ roomId } = {}) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      try {
        room.addPlayer(socket.id, userId);
      } catch (err) {
        socket.emit('error', { message: err.message });
        return;
      }

      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      io.to(roomId).emit('player-joined', { roomId, playerCount: room.players.length });
    });

    // ------------------------------------------------------------------
    // matchmake  — public matchmaking
    // ------------------------------------------------------------------
    socket.on('matchmake', () => {
      // Check if already in queue
      const alreadyQueued = matchmakingQueue.findIndex(
        (entry) => entry.socketId === socket.id
      );
      if (alreadyQueued !== -1) return;

      if (matchmakingQueue.length > 0) {
        // Pair with the first waiting player
        const opponent = matchmakingQueue.shift();
        const opponentSocket = io.sockets.sockets.get(opponent.socketId);

        if (!opponentSocket) {
          // Opponent disconnected before match was made — re-queue current socket
          matchmakingQueue.push({ socketId: socket.id, userId });
          socket.emit('matchmaking', { status: 'waiting' });
          return;
        }

        const roomId = generateRoomCode();
        const room = new GameRoom(roomId, 'pvp');
        room.addPlayer(opponent.socketId, opponent.userId);
        room.addPlayer(socket.id, userId);

        rooms.set(roomId, room);
        socketToRoom.set(opponent.socketId, roomId);
        socketToRoom.set(socket.id, roomId);

        opponentSocket.join(roomId);
        socket.join(roomId);

        io.to(roomId).emit('match-found', { roomId });
      } else {
        // Add to queue and set timeout
        matchmakingQueue.push({ socketId: socket.id, userId });
        socket.emit('matchmaking', { status: 'waiting' });

        const timeoutHandle = setTimeout(() => {
          const idx = matchmakingQueue.findIndex((e) => e.socketId === socket.id);
          if (idx !== -1) {
            matchmakingQueue.splice(idx, 1);
            socket.emit('matchmaking', { status: 'timeout' });
          }
        }, 30000);

        // Store timeout so cancel-matchmake can clear it
        disconnectTimers.set(`matchmake:${socket.id}`, timeoutHandle);
      }
    });

    // ------------------------------------------------------------------
    // cancel-matchmake
    // ------------------------------------------------------------------
    socket.on('cancel-matchmake', () => {
      const idx = matchmakingQueue.findIndex((e) => e.socketId === socket.id);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
      }
      const timerKey = `matchmake:${socket.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
      }
    });

    // ------------------------------------------------------------------
    // place-ships  { ships }
    // ------------------------------------------------------------------
    socket.on('place-ships', ({ ships } = {}) => {
      const roomId = socketToRoom.get(socket.id);
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        room.placeShips(socket.id, ships);
      } catch (err) {
        socket.emit('error', { message: err.message });
        return;
      }

      socket.emit('ships-placed', { roomId });

      // Both players ready → start game
      if (room.phase === 'playing') {
        for (const player of room.players) {
          if (player.isAI) continue;
          const pSocket = io.sockets.sockets.get(player.socketId);
          if (pSocket) {
            pSocket.emit('game-start', { roomId, mode: room.mode });
            pSocket.emit('game-state', room.getState(player.socketId));
          }
        }
      }
    });

    // ------------------------------------------------------------------
    // fire  { row, col }
    // ------------------------------------------------------------------
    socket.on('fire', async ({ row, col } = {}) => {
      const roomId = socketToRoom.get(socket.id);
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      let result;
      try {
        result = room.fire(socket.id, row, col);
      } catch (err) {
        socket.emit('error', { message: err.message });
        return;
      }

      // Emit human fire result to entire room
      io.to(roomId).emit('fire-result', {
        shooter: socket.id,
        row,
        col,
        result: result.result,
        shipName: result.shipName,
        sunk: result.sunk,
        gameOver: result.gameOver,
        winner: result.winner,
      });

      // Emit AI counter-move as a separate event (if present)
      if (result.aiMove) {
        io.to(roomId).emit('fire-result', {
          shooter: 'ai-player',
          row: result.aiMove.row,
          col: result.aiMove.col,
          result: result.aiMove.result,
          shipName: result.aiMove.shipName,
          sunk: result.aiMove.sunk,
          gameOver: result.gameOver,
          winner: result.winner,
        });
      }

      if (result.gameOver) {
        const stats = room.getStats();
        // Send per-player stats
        for (const player of room.players) {
          const isP1 = room.players[0] && room.players[0].socketId === player.socketId;
          const playerSocket = io.sockets.sockets.get(player.socketId);
          if (playerSocket) {
            playerSocket.emit('game-over', {
              winner: result.winner,
              roomId,
              turns: stats.turns,
              duration: stats.duration_seconds ? stats.duration_seconds * 1000 : null,
              accuracy: Math.round((isP1 ? stats.player1_accuracy : stats.player2_accuracy) * 100),
              mode: stats.mode,
            });
          }
        }
        await saveGameResult(room);
        // Clean up room
        rooms.delete(roomId);
        for (const player of room.players) {
          socketToRoom.delete(player.socketId);
        }
      } else {
        io.to(roomId).emit('turn-change', { currentTurn: room.currentTurn });
      }
    });

    // ------------------------------------------------------------------
    // get-state
    // ------------------------------------------------------------------
    socket.on('get-state', () => {
      const roomId = socketToRoom.get(socket.id);
      const room = roomId ? rooms.get(roomId) : null;
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }
      socket.emit('game-state', room.getState(socket.id));
    });

    // ------------------------------------------------------------------
    // disconnect
    // ------------------------------------------------------------------
    socket.on('disconnect', () => {
      // Remove from matchmaking queue (and clear its timer)
      const qIdx = matchmakingQueue.findIndex((e) => e.socketId === socket.id);
      if (qIdx !== -1) {
        matchmakingQueue.splice(qIdx, 1);
      }
      const matchmakeTimerKey = `matchmake:${socket.id}`;
      if (disconnectTimers.has(matchmakeTimerKey)) {
        clearTimeout(disconnectTimers.get(matchmakeTimerKey));
        disconnectTimers.delete(matchmakeTimerKey);
      }

      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) {
        socketToRoom.delete(socket.id);
        return;
      }

      // AI games — just clean up immediately
      if (room.mode !== 'pvp') {
        rooms.delete(roomId);
        socketToRoom.delete(socket.id);
        return;
      }

      // PvP — give the disconnected player 30 seconds to reconnect
      const reconnectTimerHandle = setTimeout(async () => {
        disconnectTimers.delete(socket.id);

        // Room may have already been cleaned up
        const currentRoom = rooms.get(roomId);
        if (!currentRoom) return;

        // Find the opponent (still connected)
        const opponent = currentRoom.players.find(
          (p) => p.socketId !== socket.id && !p.isAI
        );

        if (opponent) {
          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          if (opponentSocket) {
            const dcStats = currentRoom.getStats();
            opponentSocket.emit('game-over', {
              winner: opponent.socketId,
              roomId,
              reason: 'opponent_disconnected',
              turns: dcStats.turns,
              duration: dcStats.duration_seconds ? dcStats.duration_seconds * 1000 : null,
              mode: dcStats.mode,
            });
          }
          // Save forfeit result if game had started
          if (currentRoom.phase === 'playing' || currentRoom.phase === 'finished') {
            currentRoom.phase = 'finished';
            currentRoom.winner = opponent.socketId;
            currentRoom.endedAt = Date.now();
            await saveGameResult(currentRoom);
          }
        }

        // Clean up
        rooms.delete(roomId);
        for (const player of currentRoom.players) {
          socketToRoom.delete(player.socketId);
        }
      }, 30000);

      disconnectTimers.set(socket.id, reconnectTimerHandle);
    });
  });
}

module.exports = { setupSocketHandlers };
