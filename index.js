const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const token = process.env.BOT_TOKEN;
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

const bot = isProduction 
  ? new TelegramBot(token)
  : new TelegramBot(token, { polling: true });

// PostgreSQL подключение
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

// Создание таблиц
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        telegram_username VARCHAR(255),
        game_nickname VARCHAR(255) UNIQUE,
        game_id VARCHAR(255) UNIQUE,
        state VARCHAR(50) DEFAULT 'awaiting_nickname',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id),
        rating INTEGER DEFAULT 1000,
        matches INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        deaths INTEGER DEFAULT 0,
        last_30_kills INTEGER[] DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bans (
        user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id),
        permanent BOOLEAN DEFAULT false,
        until TIMESTAMP,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        banned_by BIGINT
      )
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка базы данных:', error);
  }
}

// Проверки
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return /^\d{8,9}$/.test(id);
}

async function isAdmin(chatId) {
  const result = await pool.query(
    'SELECT COUNT(*) FROM users WHERE telegram_id = $1 AND telegram_id IN (6005466815)',
    [chatId]
  );
  return result.rows[0].count > 0;
}

async function isBanned(chatId) {
  const result = await pool.query(
    `SELECT * FROM bans WHERE user_id = $1 AND (permanent = true OR until > NOW())`,
    [chatId]
  );
  return result.rows.length > 0;
}

function getBanTimeLeft(until) {
  if (!until) return 'навсегда';
  const timeLeft = new Date(until) - Date.now();
  if (timeLeft <= 0) return 'истек';
  
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч`;
  return 'менее часа';
}

// Главное меню
function showMainMenu(chatId, username) {
  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎮 Найти матч', callback_data: 'find_match' },
          { text: '📊 Профиль', callback_data: 'profile' }
        ],
        [
          { text: '🏆 Рейтинг', callback_data: 'rating' },
          { text: '👥 Друзья', callback_data: 'friends' }
        ],
        [
          { text: '📋 Команды', callback_data: 'commands' },
          { text: '❓ Помощь', callback_data: 'help' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, `🎮 Добро пожаловать, ${username}!\n\nВыберите действие:`, menuOptions);
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  try {
    if (await isBanned(chatId)) {
      const banResult = await pool.query(
        'SELECT * FROM bans WHERE user_id = $1',
        [chatId]
      );
      const ban = banResult.rows[0];
      const timeLeft = getBanTimeLeft(ban.until);
      const message = ban.permanent 
        ? '❌ Вы получили бан навсегда.'
        : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
      return bot.sendMessage(chatId, message);
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [chatId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].state === 'completed') {
      showMainMenu(chatId, username);
    } else {
      if (userResult.rows.length === 0) {
        await pool.query(
          'INSERT INTO users (telegram_id, telegram_username, state) VALUES ($1, $2, $3)',
          [chatId, username, 'awaiting_nickname']
        );
      } else {
        await pool.query(
          'UPDATE users SET state = $1 WHERE telegram_id = $2',
          ['awaiting_nickname', chatId]
        );
      }
      
      bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите игровой nickname:\n• Только EN буквы, цифры, _\n• 3-20 символов`);
    }
  } catch (error) {
    console.error('Error in /start:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Обработка сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text || text.startsWith('/')) return;

  try {
    if (await isBanned(chatId)) {
      return bot.sendMessage(chatId, '❌ Вы забанены.');
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [chatId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];

    if (user.state === 'awaiting_nickname') {
      if (!isValidNickname(text)) {
        return bot.sendMessage(chatId, '❌ Неверный формат! Только EN буквы, цифры, _. 3-20 символов.');
      }

      await pool.query(
        'UPDATE users SET game_nickname = $1, state = $2 WHERE telegram_id = $3',
        [text, 'awaiting_id', chatId]
      );
      
      bot.sendMessage(chatId, '✅ Теперь введите ID игры (8-9 цифр):');
      
    } else if (user.state === 'awaiting_id') {
      if (!isValidGameId(text)) {
        return bot.sendMessage(chatId, '❌ Неверный ID! Только 8-9 цифр.');
      }

      await pool.query(
        'UPDATE users SET game_id = $1, state = $2 WHERE telegram_id = $3',
        [text, 'completed', chatId]
      );

      await pool.query(
        'INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [chatId]
      );
      
      bot.sendMessage(chatId, `🎉 Регистрация завершена!\nNickname: ${user.game_nickname}\nID: ${text}`);
      showMainMenu(chatId, user.telegram_username);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Webhook настройка
if (isProduction) {
  const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`;
  
  app.post('/', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  bot.setWebHook(webhookUrl).then(() => {
    console.log('🔗 Webhook установлен');
  }).catch(console.error);
}

// Health check
app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

// Запуск
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  await initDatabase();
});

console.log(`🤖 Бот запущен в режиме: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);