import { supabase } from "../config/database.js";

// Админ выдаёт предупреждение: /warn <tg_id> <причина>
export default function warningsHandler(bot) {
  bot.onText(/^\/warn\s+(\d+)\s+(.+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(process.env.ADMIN_TG_ID)) return;

    const tgId = Number(match[1]);
    const reason = (match[2] || "").trim();

    try {
      const { error } = await supabase
        .from("warnings")
        .insert({ user_id: tgId, reason });

      if (error) throw error;

      await supabase.from("logs").insert({ action: `warn_to:${tgId}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `⚠️ Предупреждение выдано пользователю ${tgId}: ${reason}`);

      // оповестим пользователя (если боту можно писать)
      bot.sendMessage(tgId, `⚠️ Вам выдано предупреждение: ${reason}`).catch(()=>{});
    } catch (e) {
      console.error("/warn error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при выдаче предупреждения.");
    }
  });
}