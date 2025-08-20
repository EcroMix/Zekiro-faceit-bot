const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');

// Конфигурация
const token = process.env.BOT_TOKEN;
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

// Инициализация бота
const bot = isProduction 
  ? new TelegramBot(token)
  : new TelegramBot(token, { polling: true });

// Инициализация Express
const app = express();
app.use(express.json());

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ID админов
const ADMIN_IDS = [6005466815]; // Добавь сюда ID админов

// Состояния пользователя
const USER_STATES = {
  AWAITING_NICKNAME: 'awaiting_nickname',
  AWAITING_ID: 'awaiting_id',
  COMPLETED: 'completed'
};

// Инициализация базы данных
async function initDatabase() {
  try {
    // Таблица пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        telegram_username VARCHAR(255),
        game_nickname VARCHAR(255),
        game_id VARCHAR(255),
        state VARCHAR(50) DEFAULT '${USER_STATES.AWAITING_NICKNAME}',
        friends TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_nickname),
        UNIQUE(game_id)
      )
    `);

    // Таблица статистики
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
        zf_rating INTEGER DEFAULT 1000,
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
        user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
        permanent BOOLEAN DEFAULT false,
        until TIMESTAMP,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        banned_by BIGINT,
        reason TEXT
      )
    `);

    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы:', error);
    throw error;
  }
}

// Валидация
function isValidNickname(nickname) {
  return nickname && /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return id && /^\d{8,9}$/.test(id);
}

// Проверка админа
function isAdmin(chatId) {
  return ADMIN_IDS.includes(chatId);
}

// Проверка бана
async function checkBan(chatId) {
  try {
    const result = await pool.query(
      `SELECT * FROM bans WHERE user_id = $1 AND (permanent = true OR until > NOW())`,
      [chatId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error checking ban:', error);
    return null;
  }
}

// Главное меню
function showMainMenu(chatId, username) {
  const menuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Найти матч', callback_data: 'find_match' }],
        [{ text: '📊 Профиль', callback_data: 'profile' }],
        [{ text: '🏆 Рейтинг', callback_data: 'rating' }],
        [{ text: '👥 Друзья', callback_data: 'friends' }],
        [{ text: '📋 Команды', callback_data: 'commands' }],
        [{ text: '❓ Помощь', callback_data: 'help' }],
        isAdmin(chatId) ? [{ text: '⚙️ Админ панель', callback_data: 'admin_panel' }] : []
      ].filter(Boolean)
    }
  };
  
  bot.sendMessage(chatId, `🎮 Добро пожаловать, ${username}!\n\nВыберите действие:`, menuOptions);
}

// Админ панель
function showAdminPanel(chatId) {
  const adminMenu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Управление пользователями', callback_data: 'admin_users' }],
        [{ text: '🔨 Управление банами', callback_data: 'admin_bans' }],
        [{ text: '📊 Статистика системы', callback_data: 'admin_stats' }],
        [{ text: '◀️ Назад в главное меню', callback_data: 'main_menu' }]
      ]
    }
  };
  
  bot.sendMessage(chatId, '⚙️ *Админ панель Zekiro Faceit*\n\nВыберите раздел для управления:', adminMenu);
}

// Показать профиль
async function showProfile(chatId) {
  try {
    const userResult = await pool.query(
      `SELECT u.*, us.zf_rating, us.matches, us.wins, us.losses, us.kills, us.deaths, us.last_30_kills
       FROM users u 
       LEFT JOIN user_stats us ON u.telegram_id = us.user_id 
       WHERE u.telegram_id = $1`,
      [chatId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].game_nickname) {
      return bot.sendMessage(chatId, '❌ Профиль не заполнен. Завершите регистрацию через /start');
    }

    const user = userResult.rows[0];
    const stats = userResult.rows[0];

    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills > 0 ? '∞' : '0.00';
    
    const last30Kills = stats.last_30_kills || [];
    const avgKills = last30Kills.length > 0 
      ? (last30Kills.reduce((sum, k) => sum + k, 0) / last30Kills.length).toFixed(1)
      : '0.0';

    const profileText = 
      `👤 *Профиль игрока Zekiro Faceit:*\n` +
      `\n` +
      `🎮 *Никнейм:* ${user.game_nickname}\n` +
      `🆔 *ID игры:* ${user.game_id}\n` +
      `⭐ *ZF рейтинг:* ${stats.zf_rating}\n` +
      `\n` +
      `📊 *Статистика:*\n` +
      `🎯 *Матчей:* ${stats.matches}\n` +
      `✅ *Побед:* ${stats.wins}\n` +
      `❌ *Поражений:* ${stats.losses}\n` +
      `📈 *Винрейт:* ${winRate}%\n` +
      `\n` +
      `🔫 *K/D:* ${kd}\n` +
      `🎯 *Среднее убийств:* ${avgKills}\n` +
      `👥 *Друзей:* ${user.friends?.length || 0}`;

    bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error showing profile:', error);
    bot.sendMessage(chatId, '❌ Ошибка загрузки профиля');
  }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name;

  try {
    // Проверка бана
    const ban = await checkBan(chatId);
    if (ban) {
      const timeLeft = ban.permanent ? 'навсегда' : `до ${new Date(ban.until).toLocaleDateString()}`;
      return bot.sendMessage(chatId, `❌ Вы забанены ${timeLeft}. Причина: ${ban.reason || 'не указана'}`);
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [chatId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].state === USER_STATES.COMPLETED) {
      showMainMenu(chatId, username);
    } else {
      if (userResult.rows.length === 0) {
        await pool.query(
          'INSERT INTO users (telegram_id, telegram_username, state) VALUES ($1, $2, $3)',
          [chatId, msg.from.username || username, USER_STATES.AWAITING_NICKNAME]
        );
      } else {
        await pool.query(
          'UPDATE users SET state = $1, telegram_username = $2 WHERE telegram_id = $3',
          [USER_STATES.AWAITING_NICKNAME, msg.from.username || username, chatId]
        );
      }
      
      bot.sendMessage(chatId, 
        `🎮 Добро пожаловать в *Zekiro Faceit*!\n\n` +
        `Для регистрации введите ваш игровой nickname:\n` +
        `• Только английские буквы, цифры и _\n` +
        `• От 3 до 20 символов`,
        { parse_mode: 'Markdown' }
      );
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
    const ban = await checkBan(chatId);
    if (ban) return;

    const userResult = await pool.query(
      'SELECT state FROM users WHERE telegram_id = $1',
      [chatId]
    );

    if (userResult.rows.length === 0) return;

    const userState = userResult.rows[0].state;

    if (userState === USER_STATES.AWAITING_NICKNAME) {
      if (!isValidNickname(text)) {
        return bot.sendMessage(chatId, 
          '❌ Неверный формат nickname!\n' +
          '• Только английские буквы (a-z, A-Z)\n' +
          '• Цифры (0-9) и нижнее подчеркивание (_)\n' +
          '• От 3 до 20 символов'
        );
      }

      await pool.query(
        'UPDATE users SET game_nickname = $1, state = $2 WHERE telegram_id = $3',
        [text, USER_STATES.AWAITING_ID, chatId]
      );
      
      bot.sendMessage(chatId, 
        '✅ Отлично! Теперь введите ваш ID игры:\n' +
        '• Только цифры\n' +
        '• 8 или 9 цифр'
      );
      
    } else if (userState === USER_STATES.AWAITING_ID) {
      if (!isValidGameId(text)) {
        return bot.sendMessage(chatId, '❌ Неверный ID игры! Должно быть 8 или 9 цифр.');
      }

      await pool.query(
        'UPDATE users SET game_id = $1, state = $2 WHERE telegram_id = $3',
        [text, USER_STATES.COMPLETED, chatId]
      );

      // Создаем запись в статистике
      await pool.query(`
        INSERT INTO user_stats (user_id) 
        VALUES ($1) 
        ON CONFLICT (user_id) DO NOTHING
      `, [chatId]);
      
      bot.sendMessage(chatId, 
        `🎉 *Регистрация в Zekiro Faceit завершена!*\n\n` +
        `📝 Ваши данные:\n` +
        `• Nickname: ${text}\n` +
        `• ID: ${text}\n\n` +
        `Теперь вы можете использовать все функции бота!`,
        { parse_mode: 'Markdown' }
      );
      
      showMainMenu(chatId, msg.from.first_name);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    if (error.code === '23505') { // Unique violation
      bot.sendMessage(chatId, '❌ Этот nickname или ID уже занят. Используйте другие данные.');
    } else {
      bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }
});

// Обработка callback запросов (кнопки)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  try {
    const ban = await checkBan(chatId);
    if (ban) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Вы забанены' });
      return;
    }

    switch (data) {
      case 'profile':
        await showProfile(chatId);
        break;
        
      case 'help':
        await bot.sendMessage(chatId, 
          '📖 *Помощь по Zekiro Faceit:*\n\n' +
          '• /start - Начать/перезапустить бота\n' +
          '• Профиль - Ваша статистика и ZF рейтинг\n' +
          '• Рейтинг - Топ игроков по ZF рейтингу\n' +
          '• Друзья - Управление друзьями\n' +
          '• Найти матч - Поиск противников\n\n' +
          'Для регистрации просто следуйте инструкциям после /start',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'admin_panel':
        if (isAdmin(chatId)) {
          await bot.deleteMessage(chatId, messageId);
          await showAdminPanel(chatId);
        } else {
          await bot.answerCallbackQuery(callbackQuery.id, { text: 'Доступ запрещен' });
        }
        break;
        
      case 'main_menu':
        await bot.deleteMessage(chatId, messageId);
        await showMainMenu(chatId, callbackQuery.from.first_name);
        break;
        
      case 'admin_users':
        if (isAdmin(chatId)) {
          const usersCount = await pool.query('SELECT COUNT(*) FROM users');
          const activeUsers = await pool.query('SELECT COUNT(*) FROM users WHERE state = $1', [USER_STATES.COMPLETED]);
          
          await bot.sendMessage(chatId,
            `👥 *Управление пользователями*\n\n` +
            `📊 Статистика:\n` +
            `• Всего пользователей: ${usersCount.rows[0].count}\n` +
            `• Активных: ${activeUsers.rows[0].count}\n` +
            `• Забаненных: ${(await pool.query('SELECT COUNT(*) FROM bans WHERE permanent = true OR until > NOW()')).rows[0].count}\n\n` +
            `⚙️ Функции управления скоростью будут добавлены...`,
            { parse_mode: 'Markdown' }
          );
        }
        break;
        
      default:
        await bot.sendMessage(chatId, '⏳ Эта функция в разработке...');
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error handling callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
  }
});

// Webhook для продакшена
if (isProduction) {
  app.post('/', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  bot.setWebHook(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/`).catch(console.error);
}

// Health check endpoints
app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Запуск сервера
app.listen(port, async () => {
  console.log(`🚀 Server running on port ${port}`);
  try {
    await initDatabase();
    console.log('✅ Database initialized');
    console.log(`🤖 Bot running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    console.log(`👑 Admin IDs: ${ADMIN_IDS.join(', ')}`);
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
});

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});