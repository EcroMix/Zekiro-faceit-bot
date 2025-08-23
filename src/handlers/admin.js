import { supabase } from "../config/database.js";

export default function adminHandler(bot) {
  const ADMIN = String(process.env.ADMIN_TG_ID || "");

  function isAdmin(id) {
    return String(id) === ADMIN;
  }

  // /adminstats -- краткая статистика
  bot.onText(/^\/adminstats$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const [{ count: usersCount }, { count: matchesCount }, { count: lobbiesCount }] =
        await Promise.all([
          supabase.from("users").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }),
          supabase.from("lobbies").select("*", { count: "exact", head: true }),
        ]);

      bot.sendMessage(
        chatId,
        `📊 Статистика:
👤 Пользователей: ${usersCount ?? 0}
🎮 Матчей: ${matchesCount ?? 0}
🧩 Лобби: ${lobbiesCount ?? 0}`
      );
    } catch (e) {
      console.error("/adminstats error:", e);
      bot.sendMessage(chatId, "❌ Ошибка получения статистики.");
    }
  });

  // /logs -- последние 20 логов
  bot.onText(/^\/logs$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    try {
      const { data, error } = await supabase
        .from("logs")
        .select("id, action, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        bot.sendMessage(chatId, "Логи пусты.");
        return;
      }

      const lines = data.map(
        (l) => `#${l.id} • ${l.created_at} • [${l.user_id}] ${l.action}`
      );
      bot.sendMessage(chatId, "Последние логи:\n" + lines.join("\n"));
    } catch (e) {
      console.error("/logs error:", e);
      bot.sendMessage(chatId, "❌ Ошибка получения логов.");
    }
  });
}