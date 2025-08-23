import { addBan } from "../models/database.js";

export async function handleBan(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await addBan(userId, "Тестовый бан", null);
  bot.sendMessage(chatId, "⛔ Ты забанен.");
}