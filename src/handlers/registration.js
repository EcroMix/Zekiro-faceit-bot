const supabase = require("../config/database");

module.exports = (bot) => {
  bot.onText(/\/register (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1];

    const { error } = await supabase
      .from("users")
      .insert([{ telegram_id: chatId, username }]);

    if (error) {
      bot.sendMessage(chatId, "Ошибка при регистрации: " + error.message);
    } else {
      bot.sendMessage(chatId, `✅ Пользователь ${username} зарегистрирован!`);
    }
  });
};