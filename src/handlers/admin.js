export function banPlayer(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Игрок забанен 🚫");
}