const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Простой веб-сервер для Render
app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Подключение к MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zekiro-bot';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Схема пользователя
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  telegramUsername: String,
  gameNickname: { type: String, unique: true, sparse: true },
  gameId: { type: String, unique: true, sparse: true },
  friends: [String],
  state: String,
  registeredAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Проверки
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(nickname);
}

function isValidGameId(id) {
  return /^\d{8,9}$/.test(id);
}

// Функция показа главного меню с inline-кнопками
async function showMainMenu(chatId, username) {
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
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  try {
    const user = await User.findOne({ telegramId: chatId, state: 'completed' });
    if (!user) return;

    switch(data) {
      case 'find_match':
        bot.sendMessage(chatId, '🔍 Ищем подходящий матч...');
        break;
      case 'profile':
        bot.sendMessage(chatId, `📊 Ваш профиль:\n\n🎮 Nickname: ${user.gameNickname}\n🆔 Game ID: ${user.gameId}\n👥 Друзей: ${user.friends.length}`);
        break;
      case 'rating':
        const topPlayers = await User.find({ state: 'completed' })
          .sort({ 'registeredAt': -1 })
          .limit(5);
        
        let ratingText = '🏆 Топ игроков:\n\n';
        topPlayers.forEach((player, index) => {
          ratingText += `${index + 1}. ${player.gameNickname} - ID: ${player.gameId}\n`;
        });
        
        bot.sendMessage(chatId, ratingText);
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
  } catch (error) {
    console.error('Error handling callback:', error);
  }
});

// Функция для меню друзей с inline-кнопками
async function showFriendsMenu(chatId) {
  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) return;

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
  } catch (error) {
    console.error('Error showing friends menu:', error);
  }
}

// Обработка кнопок друзей
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  try {
    const user = await User.findOne({ telegramId: chatId, state: 'completed' });
    if (!user) return;

    switch(data) {
      case 'add_friend':
        bot.sendMessage(chatId, 'Введите username друга в Telegram (например, @username):');
        user.friendAction = 'adding';
        await user.save();
        break;
      case 'remove_friend':
        if (user.friends.length === 0) {
          bot.sendMessage(chatId, '❌ У вас нет друзей для удаления');
        } else {
          bot.sendMessage(chatId, 'Введите username друга для удаления:');
          user.friendAction = 'removing';
          await user.save();
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
        const availableFriends = await User.find({ 
          state: 'completed',
          telegramId: { $ne: chatId }
        }).limit(10);
        
        if (availableFriends.length === 0) {
          bot.sendMessage(chatId, '😔 Пока нет других зарегистрированных игроков');
        } else {
          let friendsText = '🔍 Доступные игроки:\n\n';
          availableFriends.forEach((player, index) => {
            friendsText += `${index + 1}. ${player.gameNickname} (ID: ${player.gameId})\n`;
          });
          bot.sendMessage(chatId, friendsText);
        }
        break;
      case 'back_to_menu':
        showMainMenu(chatId, user.telegramUsername);
        break;
    }
  } catch (error) {
    console.error('Error handling friends callback:', error);
  }
});

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
  try {
    let user = await User.findOne({ telegramId: chatId });
    
    if (user && user.state === 'completed') {
      showMainMenu(chatId, username);
    } else {
      if (!user) {
        user = new User({
          telegramId: chatId,
          telegramUsername: username,
          gameNickname: null,
          gameId: null,
          friends: [],
          state: 'awaiting_nickname'
        });
      } else {
        user.state = 'awaiting_nickname';
      }
      
      await user.save();
      bot.sendMessage(chatId, `🎮 Привет, ${username}!\n\nНапишите свой игровой nickname:\n• Только английские буквы\n• Цифры и символ _\n• От 3 до 20 символов`);
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
    const user = await User.findOne({ telegramId: chatId });
    if (!user) return;
    
    if (user.state === 'completed') {
      if (user.friendAction) {
        await handleFriendActions(msg, user);
      } else {
        bot.sendMessage(chatId, 'Используйте кнопки меню 📱');
      }
    } else {
      await handleRegistration(msg, user);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Обработка добавления/удаления друзей
async function handleFriendActions(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  try {
    if (user.friendAction === 'adding') {
      if (!user.friends.includes(text)) {
        user.friends.push(text);
        await user.save();
        bot.sendMessage(chatId, `✅ Друг ${text} добавлен!`);
      } else {
        bot.sendMessage(chatId, '❌ Этот друг уже в списке');
      }
      user.friendAction = null;
      await user.save();
      showFriendsMenu(chatId);
    } else if (user.friendAction === 'removing') {
      const index = user.friends.indexOf(text);
      if (index > -1) {
        user.friends.splice(index, 1);
        await user.save();
        bot.sendMessage(chatId, `✅ Друг ${text} удален!`);
      } else {
        bot.sendMessage(chatId, '❌ Друг не найден в списке');
      }
      user.friendAction = null;
      await user.save();
      showFriendsMenu(chatId);
    }
  } catch (error) {
    console.error('Error handling friend action:', error);
    bot.sendMessage(chatId, '❌ Ошибка при обработке друга');
  }
}

// Функция обработки регистрации
async function handleRegistration(msg, user) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  
  try {
    if (user.state === 'awaiting_nickname') {
      if (!isValidNickname(text)) {
        return bot.sendMessage(chatId, '❌ Неверный формат! Используйте только:\n• Английские буквы (A-Z, a-z)\n• Цифры (0-9)\n• Символ _\n• Длина 3-20 символов\n\nПопробуйте еще раз:');
      }
      
      // Проверка на уникальность никнейма
      const existingNickname = await User.findOne({ gameNickname: text });
      if (existingNickname) {
        return bot.sendMessage(chatId, '❌ Этот nickname уже занят! Выберите другой.');
      }
      
      user.gameNickname = text;
      user.state = 'awaiting_id';
      await user.save();
      
      bot.sendMessage(chatId, '✅ Отлично! Теперь напишите ваш ID в игре:\n• Только цифры\n• 8 или 9 символов\n\nПример: 12345678');
    } else if (user.state === 'awaiting_id') {
      if (!isValidGameId(text)) {
        return bot.sendMessage(chatId, '❌ Неверный ID! Должен быть:\n• Только цифры (0-9)\n• Ровно 8 или 9 символов\n\nПопробуйте еще раз:');
      }
      
      // Проверка на уникальность ID
      const existingGameId = await User.findOne({ gameId: text });
      if (existingGameId) {
        return bot.sendMessage(chatId, '❌ Этот ID уже зарегистрирован! Проверьте правильность.');
      }
      
      user.gameId = text;
      user.state = 'completed';
      await user.save();
      
      bot.sendMessage(chatId, `🎉 Регистрация завершена!\n\n📝 Ваши данные:\n• Nickname: ${user.gameNickname}\n• Game ID: ${user.gameId}\n\nТеперь вы можете пользоваться всеми функциями бота!`);
      showMainMenu(chatId, user.telegramUsername);
    }
  } catch (error) {
    if (error.code === 11000) {
      bot.sendMessage(chatId, '❌ Этот nickname или ID уже заняты! Используйте другие значения.');
    } else {
      console.error('Error during registration:', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
    }
  }
}

// Админ команды
bot.onText(/\/data/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() === process.env.ADMIN_ID) {
    try {
      const users = await User.find({});
      const userList = users.map(user => 
        `👤 ${user.telegramUsername}\n🎮 ${user.gameNickname || 'нет'}\n🆔 ${user.gameId || 'нет'}\n👥 Друзей: ${user.friends.length}\n📱 ${user.telegramId}\n――――――――――――`
      ).join('\n');
      
      bot.sendMessage(chatId, `📊 Зарегистрированные пользователи:\n\n${userList || 'Нет данных'}`);
    } catch (error) {
      console.error('Error in /data command:', error);
      bot.sendMessage(chatId, '❌ Ошибка при получении данных');
    }
  }
});

console.log('🤖 Бот запущен с MongoDB и уникальными проверками!');
