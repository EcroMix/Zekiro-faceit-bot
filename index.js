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

// PostgreSQL подключение с исправлением SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Создание таблиц
async function initDatabase() {
  try {
    // Таблица пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        telegram_username VARCHAR(255),
        game_nickname VARCHAR(255) UNIQUE,
        game_id VARCHAR(255) UNIQUE,
        state VARCHAR(50) DEFAULT 'awaiting_nickname',
        friends TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица статистики
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица банов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(telegram_id),
        permanent BOOLEAN DEFAULT false,
        until TIMESTAMP,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        banned_by BIGINT,
        reason TEXT
      )
    `);

    // Добавляем админа по умолчанию
    await pool.query(`
      INSERT INTO users (telegram_id, telegram_username, state)
      VALUES (6005466815, 'admin', 'completed')
      ON CONFLICT (telegram_id) DO NOTHING
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы:', error);
  }
}

// Проверки
function isValidNickname(nickname) {
  return nickname && /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return id && /^\d{8,9}$/.test(id);
}

// Проверка админа
async function isAdmin(chatId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM users WHERE telegram_id = $1 AND telegram_id = 6005466815',
      [chatId]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking admin:', error);
    return false;
  }
}

// Проверка бана
async function isBanned(chatId) {
  try {
    const result = await pool.query(
      `SELECT * FROM bans WHERE user_id = $1 AND (permanent = true OR until > NOW())`,
      [chatId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking ban:', error);
    return false;
  }
}

// Время до разбана
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

// Функция показа профиля
async function showProfile(chatId) {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [chatId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].game_nickname) {
      return bot.sendMessage(chatId, '❌ Профиль не заполнен. Завершите регистрацию через /start');
    }

    const user = userResult.rows[0];
    const statsResult = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [chatId]
    );

    const stats = statsResult.rows[0] || {
      rating: 1000,
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      last_30_kills: []
    };

    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills > 0 ? '∞' : '0.00';
    
    const last30Kills = stats.last_30_kills || [];
    const avgKills = last30Kills.length > 0 
      ? (last30Kills.reduce((sum, k) => sum + k, 0) / last30Kills.length).toFixed(1)
      : '0.0';

    const profileText = 
      `👤 *Профиль игрока:*\n` +
      `\n` +
      `📱 *TG ID:* ${chatId}\n` +
      `\n` +
      `🎮 *Никнейм:* ${user.game_nickname}\n` +
      `🆔 *ID игры:* ${user.game_id}\n` +
      `⭐ *ZF рейтинг:* ${stats.rating}\n` +
      `\n` +
      `📊 *Статистика:*\n` +
      `🎯 *Сыграно матчей:* ${stats.matches}\n` +
      `✅ *Победы:* ${stats.wins}\n` +
      `❌ *Поражения:* ${stats.losses}\n` +
      `📈 *Винрейт:* ${winRate}%\n` +
      `\n` +
      `🔫 *K/D:* ${kd} (${stats.kills}/${stats.deaths})\n` +
      `🎯 *AVG:* ${avgKills} за 30 игр\n` +
      `\n` +
      `👥 *Друзей:* ${user.friends?.length || 0}`;

    bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error showing profile:', error);
    bot.sendMessage(chatId, '❌ Ошибка загрузки профиля');
  }
}

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  try {
    if (await isBanned(chatId)) {
      const banResult = await pool.query(
        'SELECT * FROM bans WHERE user_id = $1 AND (permanent = true OR until > NOW())',
        [chatId]
      );
      
      if (banResult.rows.length > 0) {
        const ban = banResult.rows[0];
        const timeLeft = getBanTimeLeft(ban.until);
        const message = ban.permanent 
          ? '❌ Вы получили бан навсегда.'
          : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
        return bot.sendMessage(chatId, message);
      }
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
          'UPDATE users SET state = $1, telegram_username = $2 WHERE telegram_id = $3',
          ['awaiting_nickname', username, chatId]
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

      // Создаем запись в статистике
      await pool.query(`
        INSERT INTO user_stats (user_id) 
        VALUES ($1) 
        ON CONFLICT (user_id) DO NOTHING
      `, [chatId]);
      
      bot.sendMessage(chatId, `🎉 Регистрация завершена!\nNickname: ${user.game_nickname}\nID: ${text}`);
      
      // Показываем главное меню
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