
import { supabase } from "../config/database.js";

export async function registerPlayer(bot, msg) {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  const { error } = await supabase
    .from("players")
    .insert([{ telegram_id: chatId, username }]);

  if (error) {
    await bot.sendMessage(chatId, "Ошибка при регистрации ❌");
  } else {
    await bot.sendMessage(chatId, "Ты успешно зарегистрирован ✅");
  }
}