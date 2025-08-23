import { supabase } from "../config/database.js";

// Админ-бан: /banuser <tg_id> <причина> [дней]
export default function bansHandler(bot) {
  bot.onText(/^\/banuser\s+(\d+)\s+(.+?)(?:\s+(\d+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(process.env.ADMIN_TG_ID)) return;

    const tgId = Number(match[1]);
    const reason = (match[2] || "").trim();
    const days = match[3] ? Number(match[3]) : null;

    try {
      let expires_at = null;
      if (days && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        expires_at = d.toISOString();
      }

      const { error } = await supabase
        .from("bans")
        .insert({ user_id: tgId, reason, expires_at });

      if (error) throw error;

      await supabase.from("logs").insert({ action: `ban_to:${tgId}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `🚫 Бан выдан пользователю ${tgId}. Причина: ${reason}${expires_at ? `, до ${expires_at}` : ""}`);

      bot.sendMessage(tgId, `🚫 Вы забанены. Причина: ${reason}${expires_at ? `, до ${expires_at}` : ""}`).catch(()=>{});
    } catch (e) {
      console.error("/banuser error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при бане пользователя.");
    }
  });

  // Разбан: /unban <tg_id>
  bot.onText(/^\/unban\s+(\d+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(process.env.ADMIN_TG_ID)) return;

    const tgId = Number(match[1]);
    try {
      const { error } = await supabase.from("bans").delete().eq("user_id", tgId);
      if (error) throw error;

      await supabase.from("logs").insert({ action: `unban:${tgId}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `✅ Пользователь ${tgId} разбанен.`);
      bot.sendMessage(tgId, `✅ Ваш бан снят.`).catch(()=>{});
    } catch (e) {
      console.error("/unban error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при разбане пользователя.");
    }
  });
}