import { supabase } from "../config/database.js";

// получить запись пользователя по @username
async function getUserRowByUsername(username) {
  const clean = username.replace(/^@/, "").trim();
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_id, username")
    .ilike("username", clean)
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// получить запись текущего по tg id
async function getMe(telegram_id) {
  const { data, error } = await supabase
    .from("users")
    .select("id, telegram_id, username")
    .eq("telegram_id", telegram_id)
    .single();
  if (error) return null;
  return data;
}

export default function matchesHandler(bot) {
  // создать матч: /match @ник
  bot.onText(/^\/match\s+(@[A-Za-z0-9_]{3,})$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const opponentName = match[1];

    try {
      const me = await getMe(chatId);
      if (!me) {
        bot.sendMessage(chatId, "Сначала /start для регистрации.");
        return;
      }

      const opponent = await getUserRowByUsername(opponentName);
      if (!opponent) {
        bot.sendMessage(chatId, `Игрок ${opponentName} не найден.`);
        return;
      }

      const { error } = await supabase.from("matches").insert({
        player1_id: me.id,
        player2_id: opponent.id,
        status: "pending",
      });
      if (error) throw error;

      await supabase.from("logs").insert({ action: `match_created with ${opponentName}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `Матч с ${opponentName} создан ✅ (статус: pending)`);
    } catch (e) {
      console.error("/match error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при создании матча.");
    }
  });

  // список моих матчей: /mymatches
  bot.onText(/^\/mymatches$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const me = await getMe(chatId);
      if (!me) {
        bot.sendMessage(chatId, "Сначала /start для регистрации.");
        return;
      }

      const { data, error } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, status, score, created_at")
        .or(`player1_id.eq.${me.id},player2_id.eq.${me.id}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) {
        bot.sendMessage(chatId, "Матчей пока нет.");
        return;
      }

      const lines = data.map(
        (m) => `#${m.id} • статус: ${m.status} • счёт: ${m.score || "-"}`
      );
      bot.sendMessage(chatId, "Ваши матчи:\n" + lines.join("\n"));
    } catch (e) {
      console.error("/mymatches error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при получении матчей.");
    }
  });

  // завершить матч и указать счёт: /finishmatch <id> <score>
  bot.onText(/^\/finishmatch\s+(\d+)\s+([0-9]+[-:][0-9]+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const matchId = Number(match[1]);
    const score = match[2];

    try {
      const me = await getMe(chatId);
      if (!me) {
        bot.sendMessage(chatId, "Сначала /start для регистрации.");
        return;
      }

      const { data: row, error: errSel } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, status")
        .eq("id", matchId)
        .single();

      if (errSel || !row) {
        bot.sendMessage(chatId, "Матч не найден.");
        return;
      }

      // Только участник матча может закрыть
      if (row.player1_id !== me.id && row.player2_id !== me.id) {
        bot.sendMessage(chatId, "Вы не участник этого матча.");
        return;
      }

      const { error } = await supabase
        .from("matches")
        .update({ status: "finished", score })
        .eq("id", matchId);

      if (error) throw error;

      await supabase.from("logs").insert({ action: `match_finished:${matchId}`, user_id: chatId }).catch(()=>{});
      bot.sendMessage(chatId, `Матч #${matchId} завершён. Счёт: ${score} ✅`);
    } catch (e) {
      console.error("/finishmatch error:", e);
      bot.sendMessage(chatId, "❌ Ошибка при завершении матча.");
    }
  });
}