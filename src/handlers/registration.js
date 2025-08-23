import { supabase } from "../config/database.js";

export default function registrationHandler(bot) {
  // /start -- регистрация/апдейт пользователя + приветствие
  bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const username = (msg.from?.username || "").trim() || `user_${chatId}`;

    try {
      // upsert по telegram_id (если есть -- обновим username)
      const { error } = await supabase
        .from("users")
        .upsert({ telegram_id: chatId, username }, { onConflict: "telegram_id" });

      if (error) throw error;

      // лог
      await supabase.from("logs").insert({ action: "user_start", user_id: chatId }).catch(()=>{});

      // меню
      const kb = {
        reply_markup: {
          keyboard: [
            [{ text: "🔎 Лобби /lobbies" }, { text: "➕ Создать лобби /createlobby" }],
            [{ text: "🎮 Матч с @ник /match" }, { text: "🎫 Тикет /ticket" }],
          ],
          resize_keyboard: true,
        },
      };

      bot.sendMessage(
        chatId,
        `Привет, ${username}! Ты зарегистрирован ✅\n\nКоманды:
- /lobbies -- список открытых лобби
- /createlobby <название> -- создать лобби
- /match @ник -- создать матч с игроком
- /ticket <тема> -- создать тикет\n\nАдмин-команды доступны администратору.`,
        kb
      );
    } catch (e) {
      console.error("registration /start error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при регистрации. Попробуйте позже.");
    }
  });
}