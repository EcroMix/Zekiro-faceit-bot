// src/models/database.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ========== USERS ==========
export async function createUser(telegramId, username) {
  return await supabase
    .from('users')
    .insert([{ telegram_id: telegramId, username }]);
}

export async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) return null;
  return data;
}

// ========== MATCHES ==========
export async function createMatch(player1, player2) {
  return await supabase
    .from('matches')
    .insert([{ player1_id: player1, player2_id: player2 }]);
}

export async function getMatchById(id) {
  return await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .single();
}

// ========== LOBBIES ==========
export async function createLobby(name, ownerId) {
  return await supabase
    .from('lobbies')
    .insert([{ name, owner_id: ownerId }]);
}

export async function getLobbies() {
  return await supabase.from('lobbies').select('*');
}

// ========== TICKETS ==========
export async function createTicket(userId, subject) {
  return await supabase
    .from('tickets')
    .insert([{ user_id: userId, subject }]);
}

export async function getUserTickets(userId) {
  return await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', userId);
}

// ========== WARNINGS ==========
export async function addWarning(userId, reason) {
  return await supabase
    .from('warnings')
    .insert([{ user_id: userId, reason }]);
}

export async function getUserWarnings(userId) {
  return await supabase
    .from('warnings')
    .select('*')
    .eq('user_id', userId);
}

// ========== BANS ==========
export async function addBan(userId, reason, expiresAt = null) {
  return await supabase
    .from('bans')
    .insert([{ user_id: userId, reason, expires_at: expiresAt }]);
}

export async function getActiveBans() {
  return await supabase
    .from('bans')
    .select('*')
    .gte('expires_at', new Date().toISOString());
}

// ========== LOGS ==========
export async function addLog(action, userId = null) {
  return await supabase
    .from('logs')
    .insert([{ action, user_id: userId }]);
}

export async function getLogs(limit = 20) {
  return await supabase
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
}