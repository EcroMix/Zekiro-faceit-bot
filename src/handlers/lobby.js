import { supabase } from "../config/database.js";
import { validateLobbyName } from "../utils/validation.js";

async function getUserRowByTgId(telegram_id) {
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_id, username")
    .eq("telegram_id", telegram_id)
    .single();
  if (error) return null;
  return data;
}

export default function lobbiesHandler(bot) {
  // список лобби
  bot.onText(/^\/lobbies$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const { data, error } = await supabase
        .from("lobbies")
        .select("id, name, owner_id, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        bot.sendMessage(chatId, "Пока нет открытых лобби.");
        return;
      }

      const lines = data.map(
        (l) => `#${l.id} • ${l.name} • статус: ${l.status}`
      );
      bot.sendMessage(chatId, "Открытые лобби:\n" + lines.join("\n"));
    } catch (e) {
      console.error("/lobbies error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при получении списка лобби.");
    }
  });

  // создать лобби
  bot.onText(/^\/createlobby (.+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const name = (match[1] || "").trim();

    if (!validateLobbyName(name)) {
      bot.sendMessage(chatId, "Название лобби слишком короткое (мин. 3 символа).");
      return;
    }

    try {
      const me = await getUserRowByTgId(chatId);
      if (!me) {
        bot.sendMessage(chatId, "Сначала сделайте /start для регистрации.");
        return;
      }

      const { error } = await supabase
        .from("lobbies")
        .insert({ name, owner_id: me.id, status: "open" });

      if (error) throw error;

      await supabase.from("logs").insert({ action: `lobby_created:${name}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `Лобби «${name}» создано ✅`);
    } catch (e) {
      console.error("/createlobby error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при создании лобби.");
    }
  });

  // закрыть лобби (владелец или админ)
  bot.onText(/^\/closelobby (\d+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const lobbyId = Number(match[1]);

    try {
      const me = await getUserRowByTgId(chatId);
      if (!me) {
        bot.sendMessage(chatId, "Сначала /start для регистрации.");
        return;
      }

      // проверим лобби
      const { data: lobby, error: errSel } = await supabase
        .from("lobbies")
        .select("id, owner_id, status")
        .eq("id", lobbyId)
        .single();

      if (errSel || !lobby) {
        bot.sendMessage(chatId, "Лобби не найдено.");
        return;
      }

      const isOwner = lobby.owner_id === me.id;
      const isAdmin = String(chatId) === String(process.env.ADMIN_TG_ID);

      if (!isOwner && !isAdmin) {
        bot.sendMessage(chatId, "У вас нет прав закрыть это лобби.");
        return;
      }

      const { error } = await supabase
        .from("lobbies")
        .update({ status: "closed" })
        .eq("id", lobbyId);

      if (error) throw error;

      await supabase.from("logs").insert({ action: `lobby_closed:${lobbyId}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `Лобби #${lobbyId} закрыто ✅`);
    } catch (e) {
      console.error("/closelobby error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при закрытии лобби.");
    }
  });
}