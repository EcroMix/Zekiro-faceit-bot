const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let users = {};

// Проверки
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return /^\d{8,9}$/.test(id);
}

// Функция показа главного меню с inline-кнопками
function showMainMenu(chatId, username) {
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
        ],
        [
          { text: '📩 Создать тикет', callback_data: 'create_ticket' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, `🎮 Добро пожаловать, ${username}!\n\nВыберите действие:`, menuOptions);
}

// Обработка inline-кнопок
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;
  const user = users[chatId];

  // Ответим на callback чтобы убрать "часики" у кнопки
  bot.answerCallbackQuery(callbackQuery.id);

  if (user && user.state === 'completed') {
    switch(data) {
      case 'find_match':
        bot.sendMessage(chatId, '🔍 Ищем подходящий матч...');
        break;
      case 'profile':
        bot.sendMessage(chatId, `📊 Ваш профиль:\n\n🎮 Nickname: ${user.gameNickname}\n🆔 Game ID: ${user.gameId}\n👥 Друзей: ${user.friends.length}`);
        break;
      case 'rating':
        bot.sendMessage(chatId, '🏆 Топ игроков:\n\n1. Player1 - 1500 рейтинг\n2. Player2 - 1450 рейтинг\n3. Player3 - 1400 рейтинг');
        break;
      case 'friends':
        showFriendsMenu(chatId);
        break;
      case 'commands':
        bot.sendMessage(chatId, '📋 Доступные команды:\n/start - главное меню\n/profile - ваш профиль\n/friends - управление друзьями');
        break;
      case 'help':
        bot.sendMessage(chatId, '❓ Помощь по боту:\n\n• Найти матч - поиск игры\n• Профиль - ваши данные\n• Друзья - управление друзьями\n• Создать тикет - техподдержка');
        break;
      case 'create_ticket':
        bot.sendMessage(chatId, '📩 Опишите вашу проблему или вопрос:');
        break;
    }
  }
});

// Функция для меню друзей с inline-кнопками
function showFriendsMenu(chatId) {
  const user = users[chatId];
  const friendsMenu = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '➕ Добавить друга', callback_data: 'add_friend' },
          { text: '➖ Удалить друга', callback_data: 'remove_friend' }
        ],
        [
          { text: '📋 Список друзей', callback_data: 'friends_list' },
          { text: '🔍 Найти друзей', callback_data: 'find_friends' }
        ],
        [
          { text: '↩️ Назад в меню', callback_data: 'back_to_menu' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, `👥 Управление друзьями\n\nВсего друзей: ${user.friends.length}`, friendsMenu);
}

// Обработка кнопок друзей
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;
  const user = users[chatId];

  bot.answerCallbackQuery(callbackQuery.id);

  if (user && user.state === 'completed') {
    switch(data) {
      case 'add_friend':
        bot.sendMessage(chatId, 'Введите username друга в Telegram (например, @username):');
        user.friendAction = 'adding';
        break;
      case 'remove_friend':
        if (user.friends.length === 0) {
          bot.sendMessage(chatId, '❌ У вас нет друзей для удаления');
        } else {
          bot.sendMessage(chatId, 'Введите username друга для удаления:');
          user.friendAction = 'removing';
        }
        break;
      case 'friends_list':
        if (user.friends.length === 0) {
          bot.sendMessage(chatId, '📝 У вас пока нет друзей');
        } else {
          const friendsList = user.friends.map((friend, index) => 
            `${index + 1}. ${friend}`
          ).join('\n');
          bot.sendMessage(chatId, `📋 Ваши друзья:\n\n${friendsList}`);
        }
        break;
      case 'find_friends':
        bot.sendMessage(chatId, '🔍 Поиск друзей по рейтингу...');
        break;
      case 'back_to_menu':
        showMainMenu(chatId, user.telegramUsername);
        break;
    }
  }
});

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
    
    bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите свой игровой nickname:\n• Только английские буквы\n• Цифры и символ _\n• От 3 до 20 символов`);
  }
});

// Обработка сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  if (!text || text.startsWith('/')) return;
  
  const user = users[chatId];
  if (!user) return;
  
  if (user.state === 'completed') {
    // Обработка текстовых ответов для друзей
    if (user.friendAction) {
      handleFriendActions(msg);
    } else {
      bot.sendMessage(chatId, 'Используйте кнопки меню или команды');
    }
  } else {
    handleRegistration(msg);
  }
});

// Обработка добавления/удаления друзей
function handleFriendActions(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = users[chatId];
  
  if (user.friendAction === 'adding') {
    if (!user.friends.includes(text)) {
      user.friends.push(text);
      bot.sendMessage(chatId, `✅ Друг ${text} добавлен!`);
    } else {
      bot.sendMessage(chatId, '❌ Этот друг уже в списке');
    }
    user.friendAction = null;
    showFriendsMenu(chatId);
  } else if (user.friendAction === 'removing') {
    const index = user.friends.indexOf(text);
    if (index > -1) {
      user.friends.splice(index, 1);
      bot.sendMessage(chatId, `✅ Друг ${text} удален!`);
    } else {
      bot.sendMessage(chatId, '❌ Друг не найден в списке');
    }
    user.friendAction = null;
    showFriendsMenu(chatId);
  }
}

// Функция обработки регистрации
function handleRegistration(msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const user = users[chatId];
  
  if (!user || user.state === 'completed') return;
  
  if (user.state === 'awaiting_nickname') {
    if (!isValidNickname(text)) {
      return bot.sendMessage(chatId, '❌ Неверный формат! Используйте только:\n• Английские буквы (A-Z, a-z)\n• Цифры (0-9)\n• Символ _\n• Длина 3-20 символов\n\nПопробуйте еще раз:');
    }
    
    user.gameNickname = text;
    user.state = 'awaiting_id';
    
    bot.sendMessage(chatId, '✅ Отлично! Теперь напишите ваш ID в игре:\n• Только цифры\n• 8 или 9 символов\n\nПример: 12345678');
  } else if (user.state === 'awaiting_id') {
    if (!isValidGameId(text)) {
      return bot.sendMessage(chatId, '❌ Неверный ID! Должен быть:\n• Только цифры (0-9)\n• Ровно 8 или 9 символов\n\nПопробуйте еще раз:');
    }
    
    user.gameId = text;
    user.state = 'completed';
    
    bot.sendMessage(chatId, `🎉 Регистрация завершена!\n\n📝 Ваши данные:\n• Nickname: ${user.gameNickname}\n• Game ID: ${user.gameId}\n\nТеперь вы можете пользоваться всеми функциями бота!`);
    showMainMenu(chatId, user.telegramUsername);
  }
}

// Админ команды
bot.onText(/\/data/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === process.env.ADMIN_ID) {
    const userList = Object.entries(users).map(([id, user]) => 
      `👤 ${user.telegramUsername}\n🎮 ${user.gameNickname || 'нет'}\n🆔 ${user.gameId || 'нет'}\n👥 Друзей: ${user.friends.length}\n📱 ${id}\n――――――――――――`
    ).join('\n');
    
    bot.sendMessage(chatId, `📊 Зарегистрированные пользователи:\n\n${userList || 'Нет данных'}`);
  }
});

console.log('🤖 Бот запущен с inline-кнопками!');
