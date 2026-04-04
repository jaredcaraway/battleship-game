'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
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
    await pool.execute('SELECT 1 FROM users LIMIT 0');
    console.log('Database connected.');
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') { // table does not exist
      console.log('Initializing database schema...');
      const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
      // MySQL doesn't support multi-statement by default; execute each statement separately
      const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await pool.execute(stmt);
      }
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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

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
// Injects Google Analytics tag if GA_MEASUREMENT_ID is set
// ---------------------------------------------------------------------------
const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const gaId = process.env.GA_MEASUREMENT_ID;
if (gaId) {
  const gaSnippet = `<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${gaId}');\n</script>`;
  indexHtml = indexHtml.replace('<head>', '<head>\n' + gaSnippet);
}

app.get('/{*splat}', (req, res) => {
  res.type('html').send(indexHtml);
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
