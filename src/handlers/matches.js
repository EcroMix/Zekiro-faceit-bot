const supabase = require("../config/database");

module.exports = function matchesHandler(bot) {
  bot.onText(/\/addmatch (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId != 6005466815) return;

    const matchesData = match[1].split("\n");
    for (let line of matchesData) {
      const [nickname, result, kills, deaths] = line.split(" - ");
      await supabase.from("matches").insert([{ nickname, result, kills, deaths }]);
    }

    bot.sendMessage(chatId, "Матчи добавлены!");
  });
};