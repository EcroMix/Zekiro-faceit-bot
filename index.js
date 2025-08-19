const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let users = {};

// Загрузка данных
if (fs.existsSync('users.json')) {
  try {
    users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  } catch (e) {
    console.log('Ошибка загрузки файла');
  }
}

function saveUsers() {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
}

// Проверки
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return /^\d{8,9}$/.test(id);
}

// Функция показа главного меню
function showMainMenu(chatId, username) {
  const menuOptions = {
    reply_markup: {
      keyboard: [
        ['Найти матч', 'Профиль'],
        ['Рейтинг игроков', 'Друзья'],
        ['Команды', 'Помощь'],
        ['Создать тикет']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  
  bot.sendMessage(chatId, `🎮 Добро пожаловать, ${username}!\n\nВыберите действие в меню ниже`, menuOptions);
}

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
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
    saveUsers();
    
    bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите свой игровой nickname:\n• Только английские буквы\n• Цифры и символ _\n• От 3 до 20 символов`);
  }
});

// Обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  if (!text) return;
  
  const user = users[chatId];
  if (!user) return;
  
  if (user.state === 'completed') {
    switch(text) {
      case 'Найти матч':
        bot.sendMessage(chatId, '🔍 Ищем подходящий матч...');
        break;
      case 'Профиль':
        bot.sendMessage(chatId, `📊 Ваш профиль:\n\n🎮 Nickname: ${user.gameNickname}\n🆔 Game ID: ${user.gameId}\n👥 Друзей: ${user.friends.length}`);
        break;
      case 'Рейтинг игроков':
        bot.sendMessage(chatId, '🏆 Топ игроков:\n\n1. Player1 - 1500 рейтинг\n2. Player2 - 1450 рейтинг\n3. Player3 - 1400 рейтинг');
        break;
      case 'Друзья':
        showFriendsMenu(chatId);
        break;
      case 'Команды':
        bot.sendMessage(chatId, '📋 Доступные команды:\n/start - главное меню\n/profile - ваш профиль\n/friends - управление друзьями');
        break;
