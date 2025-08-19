const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let users = {};

// Безопасная загрузка данных
try {
  if (fs.existsSync('users.json')) {
    const data = fs.readFileSync('users.json', 'utf8');
    if (data && data.trim() !== '') {
      users = JSON.parse(data);
    }
  } else {
    // Создаем файл если его нет
    fs.writeFileSync('users.json', '{}');
  }
} catch (e) {
  console.log('Создаем новый файл users.json');
  fs.writeFileSync('users.json', '{}');
}

function saveUsers() {
  try {
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  } catch (e) {
    console.log('Ошибка сохранения файла:', e.message);
  }
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
  
  if (!text || text.startsWith('/')) return;
  
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
      case 'Помощь':
        bot.sendMessage(chatId, '❓ Помощь по боту:\n\n• Найти матч - поиск игры\n• Профиль - ваши данные\n• Друзья - управление друзьями\n• Создать тикет - техподдержка');
        break;
      case 'Создать тикет':
        bot.sendMessage(chatId, '📩 Опишите вашу проблему или вопрос:');
        break;
      default:
        // Если это не команда меню
        bot.sendMessage(chatId, 'Используйте кнопки меню или команды');
    }
  } else {
    handleRegistration(msg);
  }
});

// Функция для меню друзей
function showFriendsMenu(chatId) {
  const user = users[chatId];
  const friendsMenu = {
    reply_markup: {
      keyboard: [
        ['Добавить друга', 'Удалить друга'],
        ['Список друзей', 'Найти друзей'],
        ['Назад в меню']
      ],
      resize_keyboard: true
    }
  };
  
  bot.sendMessage(chatId, `👥 Управление друзьями\n\nВсего друзей: ${user.friends.length}`, friendsMenu);
}

// Обработка кнопок друзей
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = users[chatId];
  
  if (user && user.state === 'completed') {
    switch(text) {
      case 'Добавить друга':
        bot.sendMessage(chatId, 'Введите username друга в Telegram (например, @username):');
        user.friendAction = 'adding';
        saveUsers();
        break;
        
      case 'Удалить друга':
        if (user.friends.length === 0) {
          bot.sendMessage(chatId, '❌ У вас нет друзей для удаления');
        } else {
          bot.sendMessage(chatId, 'Введите username друга для удаления:');
          user.friendAction = 'removing';
          saveUsers();
        }
        break;
        
      case 'Список друзей':
        if (user.friends.length === 0) {
          bot.sendMessage(chatId, '📝 У вас пока нет друзей');
        } else {
          const friendsList = user.friends.map((friend, index) => 
            `${index + 1}. ${friend}`
          ).join('\n');
          bot.sendMessage(chatId, `📋 Ваши друзья:\n\n${friendsList}`);
        }
        break;
        
      case 'Найти друзей':
        bot.sendMessage(chatId, '🔍 Поиск друзей по рейтингу...');
        break;
        
      case 'Назад в меню':
        showMainMenu(chatId, user.telegramUsername);
        break;
    }
  }
});

// Обработка добавления/удаления друзей
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = users[chatId];
  
  if (user && user.friendAction) {
    if (user.friendAction === 'adding') {
      // Добавление друга
      if (!user.friends.includes(text)) {
        user.friends.push(text);
        saveUsers();
        bot.sendMessage(chatId, `✅ Друг ${text} добавлен!`);
      } else {
        bot.sendMessage(chatId, '❌ Этот друг уже в списке');
      }
      user.friendAction = null;
      saveUsers();
      showFriendsMenu(chatId);
      
    } else if (user.friendAction === 'removing') {
      // Удаление друга
      const index = user.friends.indexOf(text);
      if (index > -1) {
        user.friends.splice(index, 1);
        saveUsers();
        bot.sendMessage(chatId, `✅ Друг ${text} удален!`);
      } else {
        bot.sendMessage(chatId, '❌ Друг не найден в списке');
      }
      user.friendAction = null;
      saveUsers();
      showFriendsMenu(chatId);
    }
  }
});

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
    saveUsers();
    
    bot.sendMessage(chatId, '✅ Отлично! Теперь напишите ваш ID в игре:\n• Только цифры\n• 8 или 9 символов\n\nПример: 12345678');
    
  } else if (user.state === 'awaiting_id') {
    if (!isValidGameId(text)) {
      return bot.sendMessage(chatId, '❌ Неверный ID! Должен быть:\n• Только цифры (0-9)\n• Ровно 8 или 9 символов\n\nПопробуйте еще раз:');
    }
    
    user.gameId = text;
    user.state = 'completed';
    saveUsers();
    
    bot.sendMessage(chatId, `🎉 Регистрация завершена!\n\n📝 Ваши данные:\n• Nickname: ${user.gameNickname}\n• Game ID: ${user.gameId}\n\nТеперь вы можете пользоваться всеми функциями бота!`);
    
    // Показываем главное меню после регистрации
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

console.log('🤖 Бот запущен с исправленной работой с файлами!');
