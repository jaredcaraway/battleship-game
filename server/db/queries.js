const pool = require('./pool');

// When database is unavailable, this gets set to the memory store
let _backend = null;

function useMemoryBackend(store) {
  _backend = store;
}

async function createUser(username, email, passwordHash) {
  if (_backend) return _backend.createUser(username, email, passwordHash);
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );
  return result.rows[0];
}

async function getUserByEmail(email) {
  if (_backend) return _backend.getUserByEmail(email);
  const result = await pool.query(
    `SELECT id, username, email, password_hash
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getUserById(id) {
  if (_backend) return _backend.getUserById(id);
  const result = await pool.query(
    `SELECT id, username, email, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateLastLogin(userId) {
  if (_backend) return _backend.updateLastLogin(userId);
  await pool.query(
    `UPDATE users SET last_login = NOW() WHERE id = $1`,
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

  const result = await pool.query(
    `INSERT INTO games
       (player1_id, player2_id, mode, winner_id, winner_anonymous,
        turns, player1_accuracy, player2_accuracy, duration_seconds, ended_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
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
  return result.rows[0];
}

async function getLeaderboard(limit = 100) {
  if (_backend) return _backend.getLeaderboard(limit);
  const result = await pool.query(
    `SELECT
       u.id,
       u.username,
       COUNT(g.id) FILTER (WHERE g.winner_id = u.id) AS wins,
       COUNT(g.id) FILTER (
         WHERE (g.player1_id = u.id OR g.player2_id = u.id)
           AND g.winner_id IS DISTINCT FROM u.id
           AND g.winner_anonymous = FALSE
       ) AS losses,
       ROUND(
         COUNT(g.id) FILTER (WHERE g.winner_id = u.id)::NUMERIC /
         NULLIF(COUNT(g.id) FILTER (
           WHERE g.player1_id = u.id OR g.player2_id = u.id
         ), 0) * 100,
         2
       ) AS win_rate,
       ROUND(
         AVG(g.turns) FILTER (WHERE g.winner_id = u.id),
         1
       ) AS avg_turns_to_win
     FROM users u
     LEFT JOIN games g
       ON g.player1_id = u.id OR g.player2_id = u.id
     GROUP BY u.id, u.username
     ORDER BY wins DESC, win_rate DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getUserStats(userId) {
  if (_backend) return _backend.getUserStats(userId);
  const result = await pool.query(
    `SELECT
       COUNT(g.id) AS total_games,
       COUNT(g.id) FILTER (WHERE g.winner_id = $1) AS wins,
       COUNT(g.id) FILTER (
         WHERE (g.player1_id = $1 OR g.player2_id = $1)
           AND g.winner_id IS DISTINCT FROM $1
           AND g.winner_anonymous = FALSE
       ) AS losses,
       ROUND(
         COUNT(g.id) FILTER (WHERE g.winner_id = $1)::NUMERIC /
         NULLIF(COUNT(g.id), 0) * 100,
         2
       ) AS win_rate,
       ROUND(
         AVG(
           CASE
             WHEN g.player1_id = $1 THEN g.player1_accuracy
             WHEN g.player2_id = $1 THEN g.player2_accuracy
           END
         ),
         2
       ) AS avg_accuracy,
       MIN(g.turns) FILTER (WHERE g.winner_id = $1) AS best_game_turns
     FROM games g
     WHERE g.player1_id = $1 OR g.player2_id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function getGameHistory(userId, limit = 10) {
  if (_backend) return _backend.getGameHistory(userId, limit);
  const result = await pool.query(
    `SELECT
       g.id,
       g.mode,
       g.turns,
       g.duration_seconds,
       g.ended_at,
       (g.winner_id = $1) AS won,
       CASE
         WHEN g.player1_id = $1 THEN g.player1_accuracy
         WHEN g.player2_id = $1 THEN g.player2_accuracy
       END AS accuracy,
       CASE
         WHEN g.player1_id = $1 THEN opp.username
         WHEN g.player2_id = $1 THEN opp2.username
       END AS opponent_username
     FROM games g
     LEFT JOIN users opp  ON opp.id  = g.player2_id AND g.player1_id = $1
     LEFT JOIN users opp2 ON opp2.id = g.player1_id AND g.player2_id = $1
     WHERE g.player1_id = $1 OR g.player2_id = $1
     ORDER BY g.ended_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

module.exports = {
  useMemoryBackend,
  createUser,
  getUserByEmail,
  getUserById,
  updateLastLogin,
  saveGame,
  getLeaderboard,
  getUserStats,
  getGameHistory,
};
