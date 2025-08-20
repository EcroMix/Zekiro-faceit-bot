const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');

// ==== Express (для Render/Keep alive) ====
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Zekiro Faceit Bot is running!'));
app.listen(port, () => console.log(`🚀 Server running on ${port}`));

// ==== Telegram Bot ====
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// ==== PostgreSQL (Supabase) ====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==== Админы ====
const admins = new Set(['6005466815']); // Твой Telegram ID

// ==== Кнопки ====
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "👤 Профиль", callback_data: "profile" }],
      [{ text: "⚙️ Админ панель", callback_data: "admin" }]
    ]
  }
};

const adminMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🚫 Заблокировать", callback_data: "ban" }],
      [{ text: "✅ Разблокировать", callback_data: "unban" }],
      [{ text: "📜 Логи", callback_data: "logs" }]
    ]
  }
};

// ==== СТАРТ ====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [chatId]);
  if (res.rows.length === 0) {
    await bot.sendMessage(chatId, "👋 Привет! Давай зарегистрируемся.\nНапиши свой игровой ник:");
    bot.once("message", async (nickMsg) => {
      const nickname = nickMsg.text;
      await pool.query(
        'INSERT INTO users (telegram_id, game_nickname) VALUES ($1, $2)',
        [chatId, nickname]
      );
      await bot.sendMessage(chatId, "✅ Ты зарегистрирован!", mainMenu);
    });
  } else {
    await bot.sendMessage(chatId, "✅ Добро пожаловать обратно!", mainMenu);
  }
});

// ==== CALLBACK кнопки ====
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // === ПРОФИЛЬ ===
  if (data === "profile") {
    const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [chatId]);
    if (res.rows.length === 0) return;
    const u = res.rows[0];

    // последние 30 игр для AVG
    const games = await pool.query(
      'SELECT * FROM matches WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT 30',
      [chatId]
    );

    let kills30 = 0, deaths30 = 0;
    games.rows.forEach(g => {
      kills30 += g.kills;
      deaths30 += g.deaths;
    });

    const totalGames30 = games.rows.length;
    const avgKills = totalGames30 > 0 ? (kills30 / totalGames30).toFixed(1) : 0;

    const totalGames = u.wins + u.losses;
    const winrate = totalGames > 0 ? ((u.wins / totalGames) * 100).toFixed(1) : 0;
    const kd = u.deaths > 0 ? (u.kills / u.deaths).toFixed(2) : "—";

    await bot.sendMessage(chatId,
      `👤 *Ваш профиль*\n\n` +
      `🎮 Ник: ${u.game_nickname}\n` +
      `🆔 Игровой ID: ${u.game_id || "—"}\n` +
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

  // === АДМИН ПАНЕЛЬ ===
  if (data === "admin") {
    if (!admins.has(chatId.toString())) {
      return bot.sendMessage(chatId, "⛔ У тебя нет доступа!");
    }
    await bot.sendMessage(chatId, "⚙️ Админ панель:\nВыберите действие ниже:", adminMenu);
  }

  // === БАН ===
  if (data === "ban") {
    if (!admins.has(chatId.toString())) return;
    await bot.sendMessage(chatId, "✍️ Напиши никнейм, срок и причину бана (через запятую). Пример:\n`PlayerNick, 7д, Читы`", { parse_mode: 'Markdown' });
    bot.once("message", async (m) => {
      const [nick, term, reason] = m.text.split(",");
      await pool.query(
        'INSERT INTO bans (game_nickname, reason, banned_by) VALUES ($1,$2,$3)',
        [nick.trim(), `${term?.trim() || "—"} | ${reason?.trim() || "—"}`, chatId]
      );
      await pool.query(
        'INSERT INTO logs (action, admin_id, target) VALUES ($1,$2,$3)',
        ['ban', chatId, nick.trim()]
      );
      await bot.sendMessage(chatId, `🚫 Игрок *${nick.trim()}* забанен.`, { parse_mode: 'Markdown' });
    });
  }

  // === РАЗБАН ===
  if (data === "unban") {
    if (!admins.has(chatId.toString())) return;
    await bot.sendMessage(chatId, "✍️ Напиши никнейм игрока для разбана:");
    bot.once("message", async (m) => {
      const nick = m.text;
      await pool.query('DELETE FROM bans WHERE game_nickname = $1', [nick.trim()]);
      await pool.query(
        'INSERT INTO logs (action, admin_id, target) VALUES ($1,$2,$3)',
        ['unban', chatId, nick.trim()]
      );
      await bot.sendMessage(chatId, `✅ Игрок *${nick.trim()}* разбанен.`, { parse_mode: 'Markdown' });
    });
  }

  // === ЛОГИ ===
  if (data === "logs") {
    if (!admins.has(chatId.toString())) return;
    const logs = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 10');
    if (logs.rows.length === 0) {
      await bot.sendMessage(chatId, "📭 Логи пустые.");
    } else {
      let text = "📜 *Последние действия админов:*\n\n";
      logs.rows.forEach(l => {
        text += `👮 ${l.admin_id} → ${l.action} ${l.target || ""} (${l.created_at.toLocaleString()})\n`;
      });
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
  }
});