module.exports = (bot) => {
  bot.onText(/\/match/, (msg) => {
    bot.sendMessage(msg.chat.id, "🎮 Матч создан!");
  });
};