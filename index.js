const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');

// === Render сервер ===
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Zekiro Faceit Bot is running!'));
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

// === Подключение к Supabase (Postgres) ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// === Бот ===
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const admins = new Set(['6005466815']); // твой Telegram ID

// Главное меню
function mainMenu(chatId) {
  bot.sendMessage(chatId, "📍 Главное меню", {
    reply_markup: {
      keyboard: [
        [{ text: "👤 Профиль" }],
        [{ text: "⚙️ Админ-панель" }]
      ],
      resize_keyboard: true
    }
  });
}

// === Обработчик сообщений ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    // Проверяем регистрацию
    const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [chatId]);
    if (res.rows.length === 0) {
      return bot.sendMessage(chatId, "👋 Добро пожаловать! Отправь свой игровой ник для регистрации:");
    }
    return mainMenu(chatId);
  }

  if (text === "👤 Профиль") {
    const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [chatId]);
    if (res.rows.length === 0) return bot.sendMessage(chatId, "⚠️ Вы не зарегистрированы! Напишите /start");
    const u = res.rows[0];

    // Последние 30 игр для AVG
    const games = await pool.query(
      'SELECT * FROM matches WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 30',
      [chatId]
    );

    let kills30 = 0, deaths30 = 0;
    games.rows.forEach(g => { kills30 += g.kills; deaths30 += g.deaths; });
    const totalGames30 = games.rows.length;
    const avgKills = totalGames30 > 0 ? (kills30 / totalGames30).toFixed(1) : 0;

    // Winrate
    const totalGames = u.wins + u.losses;
    const winrate = totalGames > 0 ? ((u.wins / totalGames) * 100).toFixed(1) : 0;

    // KD (накопительно)
    const kd = u.deaths > 0 ? (u.kills / u.deaths).toFixed(2) : "—";

    await bot.sendMessage(chatId,
      `👤 *Ваш профиль*\n\n` +
      `🎮 Ник: ${u.game_nickname}\n` +
      `🆔 Игровой ID: ${u.game_id}\n` +
      `📌 Telegram ID: ${u.telegram_id}\n\n` +
      `✅ Победы: ${u.wins}\n` +
      `❌ Поражения: ${u.losses}\n` +
      `📊 Winrate: ${winrate}%\n` +
      `🪙 ZF: ${u.zf_points}\n` +
      `🔫 K/D: ${kd} (${u.kills}/${u.deaths})\n` +
      `🎯 AVG Kills (30 игр): ${avgKills}`,
      { parse_mode: 'Markdown' }
    );
  }

  if (text === "⚙️ Админ-панель") {
    if (!admins.has(chatId.toString())) return bot.sendMessage(chatId, "❌ Нет доступа");
    bot.sendMessage(chatId, "⚙️ *Админ-панель*\n\nВыберите действие ниже:", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚫 Заблокировать", callback_data: "ban" }],
          [{ text: "✅ Разблокировать", callback_data: "unban" }],
          [{ text: "📜 Логи", callback_data: "logs" }]
        ]
      }
    });
  }
});

// === Обработчик кнопок ===
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === "ban") {
    bot.sendMessage(chatId, "✍️ Напишите ник, срок и причину бана в формате:\n\n`ник | срок | причина`", { parse_mode: "Markdown" });
    bot.once("message", async (msg) => {
      const [nick, duration, reason] = msg.text.split("|").map(s => s.trim());
      await pool.query("INSERT INTO bans (game_nickname, reason, banned_by) VALUES ($1,$2,$3)", [nick, reason, chatId]);
      await pool.query("INSERT INTO logs (action, admin_id, target) VALUES ($1,$2,$3)", ["ban", chatId, nick]);
      bot.sendMessage(chatId, `✅ Игрок ${nick} заблокирован.\nСрок: ${duration}\nПричина: ${reason}`);
    });
  }

  if (action === "unban") {
    bot.sendMessage(chatId, "✍️ Напишите ник для разбана:");
    bot.once("message", async (msg) => {
      const nick = msg.text.trim();
      await pool.query("DELETE FROM bans WHERE game_nickname = $1", [nick]);
      await pool.query("INSERT INTO logs (action, admin_id, target) VALUES ($1,$2,$3)", ["unban", chatId, nick]);
      bot.sendMessage(chatId, `✅ Игрок ${nick} разбанен`);
    });
  }

  if (action === "logs") {
    const logs = await pool.query("SELECT * FROM logs ORDER BY created_at DESC LIMIT 10");
    if (logs.rows.length === 0) return bot.sendMessage(chatId, "📭 Логи пусты.");
    let text = "📜 *Последние действия админов:*\n\n";
    logs.rows.forEach(l => {
      text += `👤 Admin: ${l.admin_id}\n➡️ Action: ${l.action}\n🎯 Target: ${l.target}\n🕒 ${l.created_at}\n\n`;
    });
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }
});