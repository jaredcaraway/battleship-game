const crypto = require('crypto');
const pool = require('./pool');

// When database is unavailable, this gets set to the memory store
let _backend = null;

function useMemoryBackend(store) {
  _backend = store;
}

function uuid() {
  return crypto.randomUUID();
}

async function createUser(username, email, passwordHash) {
  if (_backend) return _backend.createUser(username, email, passwordHash);
  const id = uuid();
  await pool.execute(
    `INSERT INTO users (id, username, email, password_hash)
     VALUES (?, ?, ?, ?)`,
    [id, username, email, passwordHash]
  );
  const [rows] = await pool.execute(
    `SELECT id, username, email, created_at FROM users WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function getUserByEmail(email) {
  if (_backend) return _backend.getUserByEmail(email);
  const [rows] = await pool.execute(
    `SELECT id, username, email, password_hash
     FROM users
     WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  if (_backend) return _backend.getUserByUsername(username);
  const [rows] = await pool.execute(
    `SELECT id, username, email, password_hash
     FROM users
     WHERE username = ?`,
    [username]
  );
  return rows[0] || null;
}

async function getUserById(id) {
  if (_backend) return _backend.getUserById(id);
  const [rows] = await pool.execute(
    `SELECT id, username, email, created_at
     FROM users
     WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function updateLastLogin(userId) {
  if (_backend) return _backend.updateLastLogin(userId);
  await pool.execute(
    `UPDATE users SET last_login = NOW() WHERE id = ?`,
    [userId]
  );
}

async function saveGame(stats) {
  if (_backend) return _backend.saveGame(stats);
  const {
    player1_id,
    player2_id,
    mode,
    winner_id,
    winner_anonymous,
    turns,
    player1_accuracy,
    player2_accuracy,
    duration_seconds,
  } = stats;

  const id = uuid();
  await pool.execute(
    `INSERT INTO games
       (id, player1_id, player2_id, mode, winner_id, winner_anonymous,
        turns, player1_accuracy, player2_accuracy, duration_seconds, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      player1_id,
      player2_id,
      mode,
      winner_id,
      winner_anonymous ?? false,
      turns,
      player1_accuracy,
      player2_accuracy,
      duration_seconds,
    ]
  );
  const [rows] = await pool.execute(
    `SELECT * FROM games WHERE id = ?`,
    [id]
  );
  return rows[0];
}

async function getLeaderboard(limit = 100) {
  if (_backend) return _backend.getLeaderboard(limit);
  const [rows] = await pool.execute(
    `SELECT
       u.id,
       u.username,
       SUM(CASE WHEN g.winner_id = u.id THEN 1 ELSE 0 END) AS wins,
       SUM(CASE
         WHEN (g.player1_id = u.id OR g.player2_id = u.id)
           AND (g.winner_id != u.id OR g.winner_id IS NULL)
           AND g.winner_anonymous = FALSE
         THEN 1 ELSE 0
       END) AS losses,
       ROUND(
         SUM(CASE WHEN g.winner_id = u.id THEN 1 ELSE 0 END) /
         NULLIF(COUNT(g.id), 0) * 100,
         2
       ) AS win_rate,
       ROUND(
         AVG(CASE WHEN g.winner_id = u.id THEN g.turns ELSE NULL END),
         1
       ) AS avg_turns_to_win
     FROM users u
     LEFT JOIN games g
       ON g.player1_id = u.id OR g.player2_id = u.id
     GROUP BY u.id, u.username
     ORDER BY wins DESC, win_rate DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getUserStats(userId) {
  if (_backend) return _backend.getUserStats(userId);
  const [rows] = await pool.execute(
    `SELECT
       COUNT(g.id) AS total_games,
       SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) AS wins,
       SUM(CASE
         WHEN (g.player1_id = ? OR g.player2_id = ?)
           AND (g.winner_id != ? OR g.winner_id IS NULL)
           AND g.winner_anonymous = FALSE
         THEN 1 ELSE 0
       END) AS losses,
       ROUND(
         SUM(CASE WHEN g.winner_id = ? THEN 1 ELSE 0 END) /
         NULLIF(COUNT(g.id), 0) * 100,
         2
       ) AS win_rate,
       ROUND(
         AVG(
           CASE
             WHEN g.player1_id = ? THEN g.player1_accuracy
             WHEN g.player2_id = ? THEN g.player2_accuracy
           END
         ),
         2
       ) AS avg_accuracy,
       MIN(CASE WHEN g.winner_id = ? THEN g.turns ELSE NULL END) AS best_game_turns
     FROM games g
     WHERE g.player1_id = ? OR g.player2_id = ?`,
    [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]
  );
  return rows[0];
}

async function getGameHistory(userId, limit = 10) {
  if (_backend) return _backend.getGameHistory(userId, limit);
  const [rows] = await pool.execute(
    `SELECT
       g.id,
       g.mode,
       g.turns,
       g.duration_seconds,
       g.ended_at,
       (g.winner_id = ?) AS won,
       CASE
         WHEN g.player1_id = ? THEN g.player1_accuracy
         WHEN g.player2_id = ? THEN g.player2_accuracy
       END AS accuracy,
       CASE
         WHEN g.player1_id = ? THEN opp.username
         WHEN g.player2_id = ? THEN opp2.username
       END AS opponent_username
     FROM games g
     LEFT JOIN users opp  ON opp.id  = g.player2_id AND g.player1_id = ?
     LEFT JOIN users opp2 ON opp2.id = g.player1_id AND g.player2_id = ?
     WHERE g.player1_id = ? OR g.player2_id = ?
     ORDER BY g.ended_at DESC
     LIMIT ?`,
    [userId, userId, userId, userId, userId, userId, userId, userId, userId, limit]
  );
  return rows;
}

module.exports = {
  useMemoryBackend,
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  updateLastLogin,
  saveGame,
  getLeaderboard,
  getUserStats,
  getGameHistory,
};
