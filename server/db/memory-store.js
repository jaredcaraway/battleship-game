'use strict';

/**
 * In-memory user/game store — fallback when MySQL is unavailable.
 * Data is lost on server restart. Suitable for local development only.
 */

const crypto = require('crypto');

const users = new Map();       // id -> { id, username, email, password_hash, created_at, last_login }
const usersByEmail = new Map(); // email -> id

function uuid() {
  return crypto.randomUUID();
}

async function createUser(username, email, passwordHash) {
  // Check uniqueness
  if (usersByEmail.has(email)) {
    const err = new Error('duplicate');
    err.code = 'ER_DUP_ENTRY';
    throw err;
  }
  for (const u of users.values()) {
    if (u.username === username) {
      const err = new Error('duplicate');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
  }

  const user = {
    id: uuid(),
    username,
    email,
    password_hash: passwordHash,
    created_at: new Date(),
    last_login: new Date(),
  };
  users.set(user.id, user);
  usersByEmail.set(email, user.id);

  const { password_hash, ...safe } = user;
  return safe;
}

async function getUserByEmail(email) {
  const id = usersByEmail.get(email);
  if (!id) return null;
  return users.get(id) || null;
}

async function getUserByUsername(username) {
  for (const user of users.values()) {
    if (user.username === username) return user;
  }
  return null;
}

async function getUserById(id) {
  const user = users.get(id);
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

async function updateLastLogin(userId) {
  const user = users.get(userId);
  if (user) user.last_login = new Date();
}

async function saveGame() {
  // No-op in memory mode — stats tracked client-side via localStorage
  return {};
}

async function getLeaderboard() {
  return [];
}

async function getUserStats() {
  return { total_games: 0, wins: 0, losses: 0, win_rate: 0, avg_accuracy: 0, best_game_turns: null };
}

async function getGameHistory() {
  return [];
}

module.exports = {
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
