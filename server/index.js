'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const fs = require('fs');
const authRoutes = require('./routes/auth');
const scoresRoutes = require('./routes/scores');
const { setupSocketHandlers } = require('./socket/handlers');
const pool = require('./db/pool');

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-random-string') {
  console.error('FATAL: JWT_SECRET not configured. Run: openssl rand -hex 32');
  process.exit(1);
}

// Auto-init database — fall back to in-memory store if unavailable
async function initDatabase() {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 0');
    console.log('Database connected.');
  } catch (err) {
    if (err.code === '42P01') { // table does not exist
      console.log('Initializing database schema...');
      const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('Database schema initialized.');
    } else {
      console.warn('Database unavailable (' + err.message + ') — using in-memory store.');
      console.warn('Auth will work but data is lost on restart.');
      const memoryStore = require('./db/memory-store');
      const { useMemoryBackend } = require('./db/queries');
      useMemoryBackend(memoryStore);
    }
  }
}
initDatabase();

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
  console.log(`Cyber Ship Battle server listening on port ${PORT}`);
});

module.exports = { app, server, io };
