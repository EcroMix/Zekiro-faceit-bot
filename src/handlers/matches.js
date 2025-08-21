export function createMatch(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Матч создан ⚔️");
}