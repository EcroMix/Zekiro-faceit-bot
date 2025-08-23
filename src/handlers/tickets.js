import { createTicket } from "../models/database.js";

export async function handleTicket(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await createTicket(userId, "Тестовый тикет");
  bot.sendMessage(chatId, "🎟 Тикет создан.");
}