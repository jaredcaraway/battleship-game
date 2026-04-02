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

// Auto-init database tables
async function initDatabase() {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 0');
  } catch (err) {
    if (err.code === '42P01') { // table does not exist
      console.log('Initializing database schema...');
      const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('Database schema initialized.');
    } else if (err.code === 'ECONNREFUSED' || err.code === '28P01') {
      console.warn('Database unavailable — auth and leaderboard features disabled.');
    } else {
      console.warn('Database check failed:', err.message);
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
