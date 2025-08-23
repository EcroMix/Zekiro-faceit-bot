import { supabase } from '../config/database.js';

// Получение пользователя по telegram_id
export async function getUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error) return null;
  return data;
}

// Создание пользователя
export async function createUser(telegramId, username) {
  const { data, error } = await supabase
    .from('users')
    .insert([{ telegram_id: telegramId, username }])
    .select()
    .single();

  if (error) throw error;
  return data;
}