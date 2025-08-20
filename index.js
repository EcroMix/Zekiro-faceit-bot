const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');

// === EXPRESS СЕРВЕР ДЛЯ RENDER ===
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// === TELEGRAM BOT ===
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// === POSTGRES (SUPABASE) ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// === КОНСТАНТЫ ===
const USER_STATES = {
  START: 'start',
  WAIT_NICKNAME: 'wait_nickname',
  WAIT_GAME_ID: 'wait_game_id',
  COMPLETED: 'completed',
};

let admins = new Set(['6005466815']); // твой Telegram ID

// === ПРОВЕРКА АДМИНА ===
function isAdmin(userId) {
  return admins.has(userId.toString());
}

// === ГЛАВНОЕ МЕНЮ ===
function showMainMenu(chatId, username) {
  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Найти матч', callback_data: 'find_match' }],
        [
          { text: '📊 Профиль', callback_data: 'profile' },
          { text: '🏆 Рейтинг', callback_data: 'rating' }
        ],
        [
          { text: '👥 Друзья', callback_data: 'friends' },
          { text: '📋 Команды', callback_data: 'commands' }
        ],
        [{ text: '❓ Помощь', callback_data: 'help' }],
        ...(isAdmin(chatId)
          ? [[{ text: '⚙️ Админ панель', callback_data: 'admin_panel' }]]
          : [])
      ]
    }
  };

  bot.sendMessage(
    chatId,
    `🎮 Добро пожаловать, ${username}!\n\nВыберите действие:`,
    menuOptions
  );
}

// === ОБРАБОТКА /start ===
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  // проверяем пользователя в БД
  const result = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [chatId]
  );

  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO users (telegram_id, telegram_username, state) VALUES ($1, $2, $3)',
      [chatId, username, USER_STATES.START]
    );
    await bot.sendMessage(chatId, '👋 Привет! Введи свой игровой ник:');
    await pool.query(
      'UPDATE users SET state = $1 WHERE telegram_id = $2',
      [USER_STATES.WAIT_NICKNAME, chatId]
    );
  } else {
    const user = result.rows[0];
    if (user.state === USER_STATES.COMPLETED) {
      showMainMenu(chatId, username);
    } else if (user.state === USER_STATES.WAIT_NICKNAME) {
      await bot.sendMessage(chatId, '✍️ Введи свой игровой ник:');
    } else if (user.state === USER_STATES.WAIT_GAME_ID) {
      await bot.sendMessage(chatId, '🔑 Введи свой игровой ID:');
    }
  }
});

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const result = await pool.query(
    'SELECT * FROM users WHERE telegram_id = $1',
    [chatId]
  );

  if (result.rows.length === 0) return;
  const user = result.rows[0];

  if (user.state === USER_STATES.WAIT_NICKNAME) {
    await pool.query(
      'UPDATE users SET game_nickname = $1, state = $2 WHERE telegram_id = $3',
      [text, USER_STATES.WAIT_GAME_ID, chatId]
    );
    await bot.sendMessage(chatId, '✅ Ник сохранён! Теперь введи свой игровой ID:');
  } else if (user.state === USER_STATES.WAIT_GAME_ID) {
    await pool.query(
      'UPDATE users SET game_id = $1, state = $2 WHERE telegram_id = $3',
      [text, USER_STATES.COMPLETED, chatId]
    );
    await bot.sendMessage(chatId, '✅ Регистрация завершена!');
    showMainMenu(chatId, user.telegram_username || user.telegram_id);
  }
});

// === ОБРАБОТКА КНОПОК ===
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  switch (action) {
    case 'find_match':
    case 'friends':
    case 'commands':
      await bot.sendMessage(chatId, '⏳ Эта функция пока недоступна...');
      break;

    case 'profile':
      const user = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [chatId]
      );
      if (user.rows.length > 0) {
        const u = user.rows[0];
        await bot.sendMessage(
          chatId,
          `👤 *Твой профиль:*\n\n` +
          `• Ник: ${u.game_nickname}\n` +
          `• ID: ${u.game_id}`,
          { parse_mode: 'Markdown' }
        );
      }
      break;

    case 'rating':
      await bot.sendMessage(chatId, '🏆 Рейтинг пока пуст.');
      break;

    case 'help':
      await bot.sendMessage(chatId, 'ℹ️ Этот бот помогает искать тиммейтов для Faceit.');
      break;

    case 'admin_panel':
      if (isAdmin(chatId)) {
        const adminMenu = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '👥 Пользователи', callback_data: 'admin_users' }],
              [{ text: '🚫 Баны', callback_data: 'admin_bans' }]
            ]
          }
        };
        await bot.sendMessage(chatId, '⚙️ Админ панель', adminMenu);
      }
      break;

    case 'admin_users':
      if (isAdmin(chatId)) {
        const users = await pool.query(
          'SELECT telegram_id, telegram_username, game_nickname, game_id FROM users WHERE state = $1',
          [USER_STATES.COMPLETED]
        );

        if (users.rows.length === 0) {
          await bot.sendMessage(chatId, 'Пока нет зарегистрированных пользователей.');
          break;
        }

        let text = '👥 *Список пользователей:*\n\n';

        users.rows.forEach(user => {
          const nickname = user.game_nickname || '—';
          const gameId = user.game_id || '—';
          const tgLink = user.telegram_username
            ? `[@${user.telegram_username}](https://t.me/${user.telegram_username})`
            : `[ID: ${user.telegram_id}](tg://user?id=${user.telegram_id})`;

          text += `• ${nickname} (${gameId}) — ${tgLink}\n`;
        });

        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      }
      break;

    case 'admin_bans':
      await bot.sendMessage(chatId, '🚫 Тут будет список заблокированных.');
      break;
  }
});