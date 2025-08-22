const supabase = require("../config/database");

module.exports = function adminHandler(bot) {
  bot.onText(/\/ban (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId != 6005466815) return;

    const [nickname, duration, reason] = match[1].split(", ");
    await supabase.from("bans").insert([{ nickname, duration, reason }]);
    bot.sendMessage(chatId, `Игрок ${nickname} заблокирован на ${duration}: ${reason}`);
  });

  bot.onText(/\/unban (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId != 6005466815) return;

    const [nickname, reason] = match[1].split(", ");
    await supabase.from("bans").delete().eq("nickname", nickname);
    bot.sendMessage(chatId, `Игрок ${nickname} разблокирован`);
  });
};