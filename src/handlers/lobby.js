export function createLobby(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Лобби создано 🎮");
}