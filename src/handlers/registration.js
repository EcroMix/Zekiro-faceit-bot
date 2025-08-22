const supabase = require("../config/database");

module.exports = function registrationHandler(bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    // Сообщение регистрации
    const regMsg = await bot.sendMessage(chatId, "Привет! Введите свой игровой никнейм:");

    // Ожидаем никнейм
    bot.once("message", async (reply) => {
      const nickname = reply.text;

      await bot.sendMessage(chatId, "Введите ваш ID игры:");
      bot.once("message", async (reply2) => {
        const gameId = reply2.text;

        // Сохраняем в Supabase
        const { error } = await supabase.from("users").insert([
          { chat_id: chatId, nickname, game_id: gameId },
        ]);

        if (error) {
          bot.sendMessage(chatId, "Ошибка при регистрации. Попробуйте позже.");
        } else {
          bot.sendMessage(chatId, "Вы успешно зарегистрированы!");
        }
      });
    });
  });
};