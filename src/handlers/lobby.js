module.exports = (bot) => {
  bot.onText(/\/lobby/, (msg) => {
    bot.sendMessage(msg.chat.id, "📢 Лобби создано!");
  });
};