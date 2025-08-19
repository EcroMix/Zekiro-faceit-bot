const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

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

// Хранилище в памяти
const fs = require('fs');
let users = {};
let bans = {};
let admins = new Set();

// Загрузка данных при запуске
function loadData() {
  try {
    if (fs.existsSync('data.json')) {
      const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
      users = data.users || {};
      bans = data.bans || {};
      admins = new Set(data.admins || []);
    }
    // Добавляем админов из переменных окружения
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    adminIds.forEach(id => admins.add(id.trim()));
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
      admins: Array.from(admins)
    };
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Ошибка сохранения данных:', error);
  }
}

// Загружаем данные при старте
loadData();

// Проверки
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return /^\d{8,9}$/.test(id);
}

// Проверка на администратора
function isAdmin(chatId) {
  return admins.has(chatId.toString());
}

// Проверка бана
function isBanned(chatId) {
  const banInfo = bans[chatId];
  if (!banInfo) return false;
  
  if (banInfo.permanent) return true;
  if (banInfo.until && Date.now() < banInfo.until) return true;
  
  // Если бан истек, удаляем его
  delete bans[chatId];
  saveData();
  return false;
}

// Получить оставшееся время бана
function getBanTimeLeft(until) {
  if (!until) return 'навсегда';
  
  const timeLeft = until - Date.now();
  if (timeLeft <= 0) return 'истек';
  
  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes} минут`;
}

// Функция показа главного меню
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
          { text: '🏆 Рейтинг игроков', callback_data: 'rating' },
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
          { text: '👥 Список пользователей', callback_data: 'admin_users' },
          { text: '🚫 Забанить', callback_data: 'admin_ban' }
        ],
        [
          { text: '✅ Разбанить', callback_data: 'admin_unban' },
          { text: '📊 Статистика банов', callback_data: 'admin_ban_stats' }
        ],
        [
          { text: '👑 Добавить админа', callback_data: 'admin_add' },
          { text: '👑 Удалить админа', callback_data: 'admin_remove' }
        ],
        [
          { text: '↩️ Назад', callback_data: 'back_to_menu' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, '⚙️ Панель администратора:', adminMenu);
}

// Обработка inline-кнопок
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

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

  // Обработка админ-кнопок
  if (data.startsWith('admin_')) {
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ Доступ запрещен');
    }
    
    switch(data) {
      case 'admin_users':
        showUserList(chatId);
        break;
      case 'admin_ban':
        bot.sendMessage(chatId, 'Введите ID пользователя и срок бана:\nПример: 123456789 7d (7 дней)\nИли: 123456789 permanent (навсегда)');
        users[chatId].adminAction = 'ban';
        break;
      case 'admin_unban':
        bot.sendMessage(chatId, 'Введите ID пользователя для разблокировки:');
        users[chatId].adminAction = 'unban';
        break;
      case 'admin_ban_stats':
        showBanStats(chatId);
        break;
      case 'admin_add':
        bot.sendMessage(chatId, 'Введите ID пользователя для добавления в админы:');
        users[chatId].adminAction = 'add_admin';
        break;
      case 'admin_remove':
        bot.sendMessage(chatId, 'Введите ID пользователя для удаления из админов:');
        users[chatId].adminAction = 'remove_admin';
        break;
    }
    return;
  }

  // Обычные кнопки
  switch(data) {
    case 'find_match':
      bot.sendMessage(chatId, '🔍 Ищем подходящий матч...');
      break;
    case 'profile':
      bot.sendMessage(chatId, `📊 Ваш профиль:\n\n🎮 Nickname: ${user.gameNickname}\n🆔 Game ID: ${user.gameId}\n👥 Друзей: ${user.friends.length}`);
      break;
    case 'rating':
      showRating(chatId);
      break;
    case 'friends':
      showFriendsMenu(chatId);
      break;
    case 'commands':
      const commandsText = isAdmin(chatId) 
        ? '📋 Доступные команды:\n/start - главное меню\n/admin - админ панель\n/ban ID срок - бан\n/unban ID - разбан\n/addadmin ID - добавить админа\n/removeadmin ID - удалить админа'
        : '📋 Доступные команды:\n/start - главное меню\n/profile - ваш профиль';
      bot.sendMessage(chatId, commandsText);
      break;
    case 'help':
      bot.sendMessage(chatId, '❓ Помощь по боту');
      break;
    case 'back_to_menu':
      showMainMenu(chatId, user.telegramUsername);
      break;
  }
});

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
    
    bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите свой игровой nickname:\n• Только английские буквы\n• Цифры и символ _\n• От 3 до 20 символов`);
  }
});

// Команда /admin
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ Доступ запрещен');
  }
  
  showAdminPanel(chatId);
});

// Команда /ban
bot.onText(/\/ban (\d+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userIdToBan = match[1];
  const duration = match[2].toLowerCase();
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ Доступ запрещен');
  }
  
  if (isBanned(userIdToBan)) {
    return bot.sendMessage(chatId, '❌ Пользователь уже заблокирован');
  }
  
  let banInfo = {};
  if (duration === 'permanent') {
    banInfo = { permanent: true, bannedAt: Date.now(), bannedBy: chatId };
  } else {
    const timeMatch = duration.match(/(\d+)([dhm])/);
    if (!timeMatch) {
      return bot.sendMessage(chatId, '❌ Неверный формат срока. Используйте: 7d (дни), 24h (часы), 60m (минуты) или permanent');
    }
    
    const amount = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    
    let milliseconds = amount * 60 * 1000; // минуты по умолчанию
    if (unit === 'h') milliseconds = amount * 60 * 60 * 1000;
    if (unit === 'd') milliseconds = amount * 24 * 60 * 60 * 1000;
    
    banInfo = { 
      until: Date.now() + milliseconds,
      bannedAt: Date.now(),
      bannedBy: chatId
    };
  }
  
  bans[userIdToBan] = banInfo;
  saveData();
  
  const timeLeft = getBanTimeLeft(banInfo.until);
  const message = banInfo.permanent 
    ? '❌ Вы получили бан навсегда.'
    : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
  
  bot.sendMessage(chatId, `✅ Пользователь ${userIdToBan} заблокирован ${banInfo.permanent ? 'навсегда' : `на ${timeLeft}`}`);
  bot.sendMessage(userIdToBan, message);
});

// Команда /unban
bot.onText(/\/unban (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userIdToUnban = match[1];
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ Доступ запрещен');
  }
  
  if (!isBanned(userIdToUnban)) {
    return bot.sendMessage(chatId, '❌ Пользователь не заблокирован');
  }
  
  delete bans[userIdToUnban];
  saveData();
  
  bot.sendMessage(chatId, `✅ Пользователь ${userIdToUnban} разблокирован`);
  bot.sendMessage(userIdToUnban, '✅ Вы были разблокированы администратором. Добро пожаловать обратно!');
});

// Команда /addadmin
bot.onText(/\/addadmin (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userIdToAdd = match[1];
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ Доступ запрещен');
  }
  
  if (admins.has(userIdToAdd)) {
    return bot.sendMessage(chatId, '❌ Пользователь уже является администратором');
  }
  
  admins.add(userIdToAdd);
  saveData();
  
  bot.sendMessage(chatId, `✅ Пользователь ${userIdToAdd} добавлен в администраторы`);
  bot.sendMessage(userIdToAdd, '🎉 Вы были назначены администратором бота!');
});

// Команда /removeadmin
bot.onText(/\/removeadmin (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userIdToRemove = match[1];
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ Доступ запрещен');
  }
  
  if (!admins.has(userIdToRemove)) {
    return bot.sendMessage(chatId, '❌ Пользователь не является администратором');
  }
  
  admins.delete(userIdToRemove);
  saveData();
  
  bot.sendMessage(chatId, `✅ Пользователь ${userIdToRemove} удален из администраторов`);
  bot.sendMessage(userIdToRemove, 'ℹ️ Вы были удалены из администраторов бота.');
});

// Обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  if (!text || text.startsWith('/')) return;
  
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
  
  // Обработка админ-действий
  if (user.adminAction && isAdmin(chatId)) {
    handleAdminActions(msg, user);
    return;
  }
  
  if (user.state === 'completed') {
    if (user.friendAction) {
      handleFriendActions(msg);
    } else {
      bot.sendMessage(chatId, 'Используйте кнопки меню 📱');
    }
  } else {
    handleRegistration(msg);
  }
});

// Обработка админ-действий
function handleAdminActions(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  switch(user.adminAction) {
    case 'ban':
      const banParts = text.split(' ');
      const banUserId = banParts[0];
      const banDuration = banParts.slice(1).join(' ');
      
      if (isBanned(banUserId)) {
        bot.sendMessage(chatId, '❌ Пользователь уже заблокирован');
      } else {
        let banInfo = {};
        if (banDuration === 'permanent') {
          banInfo = { permanent: true, bannedAt: Date.now(), bannedBy: chatId };
        } else {
          const timeMatch = banDuration.match(/(\d+)([dhm])/);
          if (!timeMatch) {
            bot.sendMessage(chatId, '❌ Неверный формат срока. Используйте: 7d, 24h, 60m или permanent');
            return;
          }
          
          const amount = parseInt(timeMatch[1]);
          const unit = timeMatch[2];
          
          let milliseconds = amount * 60 * 1000;
          if (unit === 'h') milliseconds = amount * 60 * 60 * 1000;
          if (unit === 'd') milliseconds = amount * 24 * 60 * 60 * 1000;
          
          banInfo = { 
            until: Date.now() + milliseconds,
            bannedAt: Date.now(),
            bannedBy: chatId
          };
        }
        
        bans[banUserId] = banInfo;
        saveData();
        
        const timeLeft = getBanTimeLeft(banInfo.until);
        const message = banInfo.permanent 
          ? '❌ Вы получили бан навсегда.'
          : `❌ Вы получили бан. Разбан через ${timeLeft}.`;
        
        bot.sendMessage(chatId, `✅ Пользователь ${banUserId} заблокирован ${banInfo.permanent ? 'навсегда' : `на ${timeLeft}`}`);
        bot.sendMessage(banUserId, message);
      }
      break;
      
    case 'unban':
      if (!isBanned(text)) {
        bot.sendMessage(chatId, '❌ Пользователь не заблокирован');
      } else {
        delete bans[text];
        saveData();
        bot.sendMessage(chatId, `✅ Пользователь ${text} разблокирован`);
        bot.sendMessage(text, '✅ Вы были разблокированы администратором. Добро пожаловать обратно!');
      }
      break;
      
    case 'add_admin':
      if (admins.has(text)) {
        bot.sendMessage(chatId, '❌ Пользователь уже является администратором');
      } else {
        admins.add(text);
        saveData();
        bot.sendMessage(chatId, `✅ Пользователь ${text} добавлен в администраторы`);
        bot.sendMessage(text, '🎉 Вы были назначены администратором бота!');
      }
      break;
      
    case 'remove_admin':
      if (!admins.has(text)) {
        bot.sendMessage(chatId, '❌ Пользователь не является администратором');
      } else {
        admins.delete(text);
        saveData();
        bot.sendMessage(chatId, `✅ Пользователь ${text} удален из администраторов`);
        bot.sendMessage(text, 'ℹ️ Вы были удалены из администраторов бота.');
      }
      break;
  }
  
  user.adminAction = null;
}

// Показать статистику банов
function showBanStats(chatId) {
  const activeBans = Object.entries(bans).filter(([_, ban]) => 
    ban.permanent || (ban.until && Date.now() < ban.until)
  );
  
  const permanentBans = activeBans.filter(([_, ban]) => ban.permanent).length;
  const tempBans = activeBans.length - permanentBans;
  
  let statsText = `📊 Статистика банов:\n\n` +
    `🚫 Всего активных банов: ${activeBans.length}\n` +
    `🔒 Перманентных: ${permanentBans}\n` +
    `⏰ Временных: ${tempBans}\n\n`;
  
  if (activeBans.length > 0) {
    statsText += '📋 Забаненные пользователи:\n';
    activeBans.forEach(([userId, ban], index) => {
      const timeLeft = getBanTimeLeft(ban.until);
      statsText += `${index + 1}. ID: ${userId} - ${ban.permanent ? 'Навсегда' : timeLeft}\n`;
    });
  }
  
  bot.sendMessage(chatId, statsText);
}

// Остальные функции (showUserList, showFriendsMenu, handleFriendActions, handleRegistration) остаются без изменений

console.log('🤖 Бот запущен с системой банов по времени и админкой по ID!');
