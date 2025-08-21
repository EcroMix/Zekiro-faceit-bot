module.exports = (bot) => {
  bot.onText(/\/ban (.+)/, (msg, match) => {
    const username = match[1];
    bot.sendMessage(msg.chat.id, `🚫 Пользователь ${username} забанен!`);
  });
};