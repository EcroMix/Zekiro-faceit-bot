const supabase = require("../config/database");

module.exports = function lobbyHandler(bot) {
  bot.onText(/\/findmatch/, async (msg) => {
    const chatId = msg.chat.id;

    // Простое сообщение с лобби
    const lobbies = [
      "Лобби №1",
      "Лобби №2",
      "Лобби №3",
      "Лобби №4",
      "Лобби №5",
    ];

    const inlineKeyboard = lobbies.map((name) => [{ text: name, callback_data: name }]);

    bot.sendMessage(chatId, "Выберите лобби:", { reply_markup: { inline_keyboard: inlineKeyboard } });
  });

  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const lobbyName = callbackQuery.data;

    // Простейшая логика добавления в лобби
    await supabase.from("lobbies").insert([{ chat_id: chatId, lobby_name: lobbyName }]);
    bot.sendMessage(chatId, `Вы присоединились к ${lobbyName}`);
  });
};