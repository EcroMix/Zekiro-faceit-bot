const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Хранилище данных
let users = {};
let bans = {};
let admins = new Set();
let userStats = {};

// Загрузка данных
function loadData() {
  try {
    if (fs.existsSync('data.json')) {
      const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
      users = data.users || {};
      bans = data.bans || {};
      admins = new Set(data.admins || []);
      userStats = data.stats || {};
      
      // Добавляем админов из переменных окружения
      const adminEnv = process.env.ADMIN_IDS || '';
      if (adminEnv) {
        adminEnv.split(',').forEach(id => admins.add(id.trim()));
      }
    }
  } catch (error) {
    console.log('Создаем новый файл данных');
  }
}

// Сохранение данных
function saveData() {
  try {
    const data = {
      users: users,
      bans: bans,
      admins: Array.from(admins),
      stats: userStats
    };
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Ошибка сохранения:', error);
  }
}

// Загружаем данные
loadData();

// Проверки
function isValidNickname(nickname) {
  return nickname && /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return id && /^\d{8,9}$/.test(id);
}

// Проверка админа
function isAdmin(chatId) {
  return admins.has(chatId.toString());
}

// Проверка бана
function isBanned(chatId) {
  const banInfo = bans[chatId];
  if (!banInfo) return false;
  
  if (banInfo.permanent) return true;
  if (banInfo.until && Date.now() < banInfo.until) return true;
  
  delete bans[chatId];
  saveData();
  return false;
}

// Время до разбана
function getBanTimeLeft(until) {
  if (!until) return 'навсегда';
  
  const timeLeft = until - Date.now();
  if (timeLeft <= 0) return 'истек';
  
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч`;
  return 'менее часа';
}

// Функция показа профиля
function showProfile(chatId) {
  const user = users[chatId];
  if (!user || !user.gameNickname) {
    return bot.sendMessage(chatId, '❌ Профиль не заполнен. Завершите регистрацию через /start');
  }

  // Получаем или создаем статистику пользователя
  if (!userStats[chatId]) {
    userStats[chatId] = {
      rating: 1000,
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      last30kills: []
    };
  }
  
  const stats = userStats[chatId];
  
  // Расчет винрейта
  const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  
  // Расчет K/D
  const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills > 0 ? '∞' : '0.00';
  
  // Расчет среднего киллов за последние 30 игр
  const avgKills = stats.last30kills.length > 0 
    ? (stats.last30kills.reduce((sum, k) => sum + k, 0) / stats.last30kills.length).toFixed(1)
    : '0.0';

  // Форматируем профиль
  const profileText = 
    `👤 *Профиль игрока:*\n` +
    `\n` +
    `📱 *TG ID:* ${chatId}\n` +
    `\n` +
    `🎮 *Никнейм:* ${user.gameNickname}\n` +
    `🆔 *ID игры:* ${user.gameId}\n` +
    `⭐ *ZF рейтинг:* ${stats.rating}\n` +
    `\n` +
    `📊 *Статистика:*\n` +
    `🎯 *Сыграно матчей:* ${stats.matches}\n` +
    `✅ *Победы:* ${stats.wins}\n` +
    `❌ *Поражения:* ${stats.losses}\n` +
    `📈 *Винрейт:* ${winRate}%\n` +
    `\n` +
    `🔫 *K/D:* ${kd} (${stats.kills}/${stats.deaths})\n` +
    `🎯 *Ср. киллов:* ${avgKills} за 30 игр\n` +
    `\n` +
    `👥 *Друзей:* ${user.friends?.length || 0}`;

  bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
}

// Главное меню
function showMainMenu(chatId, username) {
  if (isBanned(chatId)) {
    const banInfo = bans[chatId];
    const timeLeft = getBanTimeLeft(banInfo.until);
    const message = banInfo.permanent 
      ? '❌ Вы получили бан навсегда.'
      : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
    return bot.sendMessage(chatId, message);
  }

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

// Админ панель
function showAdminPanel(chatId) {
  const adminMenu = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👥 Список users', callback_data: 'admin_users' },
          { text: '🚫 Забанить', callback_data: 'admin_ban' }
        ],
        [
          { text: '✅ Разбанить', callback_data: 'admin_unban' },
          { text: '📊 Статистика', callback_data: 'admin_stats' }
        ],
        [
          { text: '↩️ Назад', callback_data: 'back_to_menu' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, '⚙️ Панель администратора:', adminMenu);
}

// Обработка кнопок
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  // Проверка бана
  if (isBanned(chatId)) {
    const banInfo = bans[chatId];
    const timeLeft = getBanTimeLeft(banInfo.until);
    const message = banInfo.permanent 
      ? '❌ Вы получили бан навсегда.'
      : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
    return bot.answerCallbackQuery(callbackQuery.id, { text: message });
  }

  bot.answerCallbackQuery(callbackQuery.id);

  const user = users[chatId];
  if (!user || user.state !== 'completed') return;

  // Админские кнопки
  if (data.startsWith('admin_')) {
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ Доступ запрещен');
    }
    
    switch(data) {
      case 'admin_users':
        showUserList(chatId);
        break;
      case 'admin_ban':
        bot.sendMessage(chatId, 'Введите ID пользователя и срок бана:\nПример: 123456789 7d\nИли: 123456789 permanent');
        users[chatId].adminAction = 'ban';
        break;
      case 'admin_unban':
        bot.sendMessage(chatId, 'Введите ID пользователя для разбана:');
        users[chatId].adminAction = 'unban';
        break;
      case 'admin_stats':
        showBanStats(chatId);
        break;
    }
    return;
  }

  // Обычные кнопки
  switch(data) {
    case 'find_match':
      bot.sendMessage(chatId, '🔍 Ищем матч...');
      break;
    case 'profile':
      showProfile(chatId);
      break;
    case 'rating':
      showRating(chatId);
      break;
    case 'friends':
      showFriendsMenu(chatId);
      break;
    case 'commands':
      const cmdText = isAdmin(chatId) 
        ? '📋 Команды:\n/start - меню\n/admin - админка\n/ban ID срок - бан\n/unban ID - разбан'
        : '📋 Команды:\n/start - меню';
      bot.sendMessage(chatId, cmdText);
      break;
    case 'help':
      bot.sendMessage(chatId, '❓ Помощь: Используйте кнопки меню');
      break;
    case 'back_to_menu':
      showMainMenu(chatId, user.telegramUsername);
      break;
  }
});

// Список пользователей
function showUserList(chatId) {
  const userList = Object.entries(users)
    .filter(([_, u]) => u.state === 'completed')
    .map(([id, u]) => `👤 ${u.telegramUsername}\n🎮 ${u.gameNickname || 'нет'}\n🆔 ${u.gameId || 'нет'}\n📱 ${id}`)
    .join('\n\n');

  bot.sendMessage(chatId, `📊 Пользователи:\n\n${userList || 'Нет данных'}`);
}

// Статистика банов
function showBanStats(chatId) {
  const activeBans = Object.entries(bans).filter(([_, b]) => 
    b.permanent || (b.until && Date.now() < b.until)
  );
  
  bot.sendMessage(chatId, 
    `📊 Статистика банов:\n\n` +
    `🚫 Активных банов: ${activeBans.length}\n` +
    `🔒 Навсегда: ${activeBans.filter(([_, b]) => b.permanent).length}\n` +
    `⏰ Временных: ${activeBans.filter(([_, b]) => !b.permanent).length}`
  );
}

// Меню друзей
function showFriendsMenu(chatId) {
  const user = users[chatId];
  const friendsCount = user.friends?.length || 0;
  
  const friendsMenu = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '➕ Добавить', callback_data: 'add_friend' },
          { text: '➖ Удалить', callback_data: 'remove_friend' }
        ],
        [
          { text: '📋 Список', callback_data: 'friends_list' }
        ],
        [
          { text: '↩️ Назад', callback_data: 'back_to_menu' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, `👥 Друзья: ${friendsCount}`, friendsMenu);
}

// Рейтинг
function showRating(chatId) {
  const activeUsers = Object.entries(userStats)
    .filter(([id, stats]) => users[id] && users[id].state === 'completed')
    .sort((a, b) => b[1].rating - a[1].rating)
    .slice(0, 10);
  
  let ratingText = '🏆 *Топ игроков по ZF рейтингу:*\n\n';
  
  activeUsers.forEach(([userId, stats], index) => {
    const user = users[userId];
    ratingText += `${index + 1}. ${user.gameNickname} - ${stats.rating} ZF\n`;
  });
  
  bot.sendMessage(chatId, ratingText || '😔 Нет игроков в рейтинге', { parse_mode: 'Markdown' });
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
  if (isBanned(chatId)) {
    const banInfo = bans[chatId];
    const timeLeft = getBanTimeLeft(banInfo.until);
    const message = banInfo.permanent 
      ? '❌ Вы получили бан навсегда.'
      : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
    return bot.sendMessage(chatId, message);
  }
  
  if (users[chatId] && users[chatId].state === 'completed') {
    showMainMenu(chatId, username);
  } else {
    users[chatId] = {
      telegramUsername: username,
      gameNickname: null,
      gameId: null,
      state: 'awaiting_nickname',
      friends: []
    };
    saveData();
    
    bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите игровой nickname:\n• Только EN буквы, цифры, _\n• 3-20 символов`);
  }
});

// Команда /admin
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, '❌ Доступ запрещен');
  showAdminPanel(chatId);
});

// Команда /ban
bot.onText(/\/ban (\d+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, '❌ Доступ запрещен');
  
  const userId = match[1];
  const duration = match[2].toLowerCase();
  
  if (isBanned(userId)) {
    return bot.sendMessage(chatId, '❌ Уже забанен');
  }
  
  let banInfo = {};
  if (duration === 'permanent') {
    banInfo = { permanent: true, bannedAt: Date.now() };
  } else {
    const timeMatch = duration.match(/(\d+)([dh])/);
    if (!timeMatch) return bot.sendMessage(chatId, '❌ Формат: 7d или 24h');
    
    const amount = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    
    let milliseconds = amount * 60 * 60 * 1000; // часы
    if (unit === 'd') milliseconds = amount * 24 * 60 * 60 * 1000;
    
    banInfo = { until: Date.now() + milliseconds, bannedAt: Date.now() };
  }
  
  bans[userId] = banInfo;
  saveData();
  
  const timeLeft = getBanTimeLeft(banInfo.until);
  const message = banInfo.permanent 
    ? '❌ Вы получили бан навсегда.'
    : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
  
  bot.sendMessage(chatId, `✅ Пользователь ${userId} забанен`);
  bot.sendMessage(userId, message);
});

// Команда /unban
bot.onText(/\/unban (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return bot.sendMessage(chatId, '❌ Доступ запрещен');
  
  const userId = match[1];
  if (!isBanned(userId)) return bot.sendMessage(chatId, '❌ Не забанен');
  
  delete bans[userId];
  saveData();
  
  bot.sendMessage(chatId, `✅ Пользователь ${userId} разбанен`);
  bot.sendMessage(userId, '✅ Вы разблокированы. Добро пожаловать!');
});

// Обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  if (!text || text.startsWith('/')) return;
  
  // Проверка бана
  if (isBanned(chatId)) {
    const banInfo = bans[chatId];
    const timeLeft = getBanTimeLeft(banInfo.until);
    const message = banInfo.permanent 
      ? '❌ Вы получили бан навсегда.'
      : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
    return bot.sendMessage(chatId, message);
  }
  
  const user = users[chatId];
  if (!user) return;
  
  // Админ действия
  if (user.adminAction && isAdmin(chatId)) {
    handleAdminAction(msg, user);
    return;
  }
  
  // Друзья
  if (user.friendAction) {
    handleFriendAction(msg, user);
    return;
  }
  
  // Регистрация
  if (user.state && user.state !== 'completed') {
    handleRegistration(msg, user);
    return;
  }
  
  bot.sendMessage(chatId, 'Используйте кнопки меню 📱');
});

// Обработка регистрации
function handleRegistration(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (user.state === 'awaiting_nickname') {
    if (!isValidNickname(text)) {
      return bot.sendMessage(chatId, '❌ Неверный формат! Только EN буквы, цифры, _. 3-20 символов.');
    }
    
    user.gameNickname = text;
    user.state = 'awaiting_id';
    saveData();
    
    bot.sendMessage(chatId, '✅ Теперь введите ID игры (8-9 цифр):');
    
  } else if (user.state === 'awaiting_id') {
    if (!isValidGameId(text)) {
      return bot.sendMessage(chatId, '❌ Неверный ID! Только 8-9 цифр.');
    }
    
    user.gameId = text;
    user.state = 'completed';
    saveData();
    
    bot.sendMessage(chatId, `🎉 Регистрация завершена!\nNickname: ${user.gameNickname}\nID: ${user.gameId}`);
    showMainMenu(chatId, user.telegramUsername);
  }
}

// Обработка админ действий
function handleAdminAction(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (user.adminAction === 'ban') {
    const parts = text.split(' ');
    const userId = parts[0];
    const duration = parts[1]?.toLowerCase();
    
    if (!duration) {
      return bot.sendMessage(chatId, '❌ Укажите срок бана');
    }
    
    if (isBanned(userId)) {
      return bot.sendMessage(chatId, '❌ Уже забанен');
    }
    
    let banInfo = {};
    if (duration === 'permanent') {
      banInfo = { permanent: true, bannedAt: Date.now() };
    } else {
      const timeMatch = duration.match(/(\d+)([dh])/);
      if (!timeMatch) return bot.sendMessage(chatId, '❌ Формат: 7d или 24h');
      
      const amount = parseInt(timeMatch[1]);
      const unit = timeMatch[2];
      
      let milliseconds = amount * 60 * 60 * 1000;
      if (unit === 'd') milliseconds = amount * 24 * 60 * 60 * 1000;
      
      banInfo = { until: Date.now() + milliseconds, bannedAt: Date.now() };
    }
    
    bans[userId] = banInfo;
    saveData();
    
    const timeLeft = getBanTimeLeft(banInfo.until);
    const message = banInfo.permanent 
      ? '❌ Вы получили бан навсегда.'
      : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
    
    bot.sendMessage(chatId, `✅ Пользователь ${userId} забанен`);
    bot.sendMessage(userId, message);
  }
  
  user.adminAction = null;
}

// Обработка друзей
function handleFriendAction(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (user.friendAction === 'adding') {
    if (!user.friends) user.friends = [];
    user.friends.push(text);
    saveData();
    bot.sendMessage(chatId, `✅ Друг ${text} добавлен`);
  }
  
  user.friendAction = null;
  showFriendsMenu(chatId);
}

// Функция для обновления статистики после матча
function updateMatchStats(chatId, isWin, kills, deaths) {
  if (!userStats[chatId]) {
    userStats[chatId] = {
      rating: 1000,
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      last30kills: []
    };
  }
  
  const stats = userStats[chatId];
  
  // Обновляем статистику
  stats.matches++;
  if (isWin) {
    stats.wins++;
    stats.rating += 25;
  } else {
    stats.losses++;
    stats.rating = Math.max(500, stats.rating - 15);
  }
  
  stats.kills += kills;
  stats.deaths += deaths;
  
  // Обновляем последние 30 игр
  stats.last30kills.push(kills);
  if (stats.last30kills.length > 30) {
    stats.last30kills.shift();
  }
  
  saveData();
}

console.log('🤖 Бот запущен с полной статистикой профиля!');
