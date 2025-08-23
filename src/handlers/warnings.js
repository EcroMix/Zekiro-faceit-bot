import { addWarning } from "../models/database.js";

export async function handleWarning(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await addWarning(userId, "Тестовое предупреждение");
  bot.sendMessage(chatId, "⚠️ Выдано предупреждение.");
}