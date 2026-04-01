'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const scoresRoutes = require('./routes/scores');
const { setupSocketHandlers } = require('./socket/handlers');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api', scoresRoutes);

// ---------------------------------------------------------------------------
// Changelog — serve raw markdown
// ---------------------------------------------------------------------------
app.get('/changelog.md', (req, res) => {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  res.type('text/plain').sendFile(changelogPath);
});

app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'changelog.html'));
});

// ---------------------------------------------------------------------------
// SPA fallback — must come after API routes
// ---------------------------------------------------------------------------
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Socket.io handlers
// ---------------------------------------------------------------------------
setupSocketHandlers(io);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Battleship server listening on port ${PORT}`);
});

module.exports = { app, server, io };
