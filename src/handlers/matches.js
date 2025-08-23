import { createMatch } from "../models/database.js";

export async function handleMatch(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "⚔️ Матч создан (заглушка, тут будет логика поиска игроков).");

  // Пример:
  // await createMatch(player1_id, player2_id);
}