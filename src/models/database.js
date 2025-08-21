import { supabase } from "../config/database.js";

// Пример функции -- получить всех игроков
export async function getPlayers() {
  const { data, error } = await supabase.from("players").select("*");
  if (error) throw error;
  return data;
}