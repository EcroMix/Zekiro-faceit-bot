import { supabase } from "../config/database.js";
import { validateTicketSubject } from "../utils/validation.js";

export default function ticketsHandler(bot) {
  // создать тикет: /ticket <тема>
  bot.onText(/^\/ticket\s+(.+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const subject = (match[1] || "").trim();

    if (!validateTicketSubject(subject)) {
      bot.sendMessage(chatId, "Укажите тему тикета: /ticket <тема>");
      return;
    }

    try {
      // user_id в tickets -- это telegram_id (как мы договорились использовать)
      const { error } = await supabase
        .from("tickets")
        .insert({ user_id: chatId, subject, status: "open" });

      if (error) throw error;

      await supabase.from("logs").insert({ action: `ticket_created`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `Тикет создан: «${subject}» ✅`);
    } catch (e) {
      console.error("/ticket error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при создании тикета.");
    }
  });

  // мои тикеты: /mytickets
  bot.onText(/^\/mytickets$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, subject, status, created_at")
        .eq("user_id", chatId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        bot.sendMessage(chatId, "У вас нет тикетов.");
        return;
      }

      const lines = data.map(
        (t) => `#${t.id} • ${t.subject} • статус: ${t.status}`
      );
      bot.sendMessage(chatId, "Ваши тикеты:\n" + lines.join("\n"));
    } catch (e) {
      console.error("/mytickets error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при получении тикетов.");
    }
  });
}