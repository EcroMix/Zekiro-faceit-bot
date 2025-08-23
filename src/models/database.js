import { query } from '../config/database.js';

export async function createUser(telegram_id, username) {
  return query(
    'INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *',
    [telegram_id, username]
  );
}

export async function getUserByTelegramId(telegram_id) {
  const res = await query('SELECT * FROM users WHERE telegram_id = $1', [telegram_id]);
  return res.rows[0];
}

export async function addMatch(player1_id, player2_id, score = null) {
  return query(
    'INSERT INTO matches (player1_id, player2_id, score) VALUES ($1, $2, $3) RETURNING *',
    [player1_id, player2_id, score]
  );
}

export async function createLobby(name, owner_id) {
  return query(
    'INSERT INTO lobbies (name, owner_id) VALUES ($1, $2) RETURNING *',
    [name, owner_id]
  );
}

export async function addTicket(user_id, subject) {
  return query(
    'INSERT INTO tickets (user_id, subject) VALUES ($1, $2) RETURNING *',
    [user_id, subject]
  );
}

export async function addWarning(user_id, reason) {
  return query(
    'INSERT INTO warnings (user_id, reason) VALUES ($1, $2) RETURNING *',
    [user_id, reason]
  );
}

export async function addBan(user_id, reason, expires_at) {
  return query(
    'INSERT INTO bans (user_id, reason, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [user_id, reason, expires_at]
  );
}

export async function addLog(action, user_id = null) {
  return query(
    'INSERT INTO logs (action, user_id) VALUES ($1, $2) RETURNING *',
    [action, user_id]
  );
}