require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.BOT_TOKEN;

// Создаем объект бота без polling
const bot = new TelegramBot(token, { polling: false });

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Пользователи в лобби
let lobbies = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": []
};

// Удаляем webhook перед запуском polling
bot.deleteWebhook()
   .then(() => {
       console.log("Webhook удален, запускаем polling...");
       bot.startPolling();
   })
   .catch(err => console.error("Ошибка при удалении webhook:", err));

// ====== События бота ======

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, "Привет! Для регистрации напиши свой игровой никнейм.");
    // Здесь можно сохранять состояние пользователя в Supabase
});

// Обработка текстовых сообщений (ник и ID игрока)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // TODO: добавить проверку состояния регистрации
    // 1. Если пользователь еще не зарегистрирован — сохраняем ник
    // 2. Запрашиваем ID игры
});

// Главное меню с inline кнопками
const mainMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "Найти матч", callback_data: "find_match" }],
            [{ text: "Профиль", callback_data: "profile" }],
            [{ text: "Рейтинг игроков", callback_data: "rating" }],
            [{ text: "Команды", callback_data: "teams" }],
            [{ text: "Создать тикет", callback_data: "ticket" }],
            [{ text: "Панель администратора", callback_data: "admin_panel" }]
        ]
    }
};

// Обработка инлайн кнопок
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    switch(data) {
        case "find_match":
            bot.deleteMessage(chatId, callbackQuery.message.message_id);
            showLobbies(chatId);
            break;
        case "profile":
            showProfile(chatId);
            break;
        case "admin_panel":
            showAdminPanel(chatId, callbackQuery.from.id);
            break;
        // TODO: остальные кнопки
    }
});

// Функция показа лобби
function showLobbies(chatId) {
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: `Лобби №1 (${lobbies["1"].length}/10)`, callback_data: 'lobby_1' }],
                [{ text: `Лобби №2 (${lobbies["2"].length}/10)`, callback_data: 'lobby_2' }],
                [{ text: `Лобби №3 (${lobbies["3"].length}/10)`, callback_data: 'lobby_3' }],
                [{ text: `Лобби №4 (${lobbies["4"].length}/10)`, callback_data: 'lobby_4' }],
                [{ text: `Лобби №5 (${lobbies["5"].length}/10)`, callback_data: 'lobby_5' }]
            ]
        }
    };
    bot.sendMessage(chatId, "Выберите лобби:", keyboard);
}

// Функция показа профиля
function showProfile(chatId) {
    // Здесь нужно вытягивать данные из Supabase
    const text = `🆔 TG: 6005466815\n👤 Никнейм: EcroMix\n🎮 Сыграно матчей: 15\n🏆 Побед: 11\n💔 Поражений: 4\n⚔️ K/D: 2.19\n🎯 AVG: 14.1`;
    bot.sendMessage(chatId, text);
}

// Функция показа админ панели
function showAdminPanel(chatId, userId) {
    const adminId = 6005466815;
    if (userId !== adminId) return bot.sendMessage(chatId, "Доступ только для админа.");
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Управление блокировкой", callback_data: "admin_block" }],
                [{ text: "Управление матчами", callback_data: "admin_matches" }],
                [{ text: "Логи", callback_data: "admin_logs" }],
                [{ text: "Информация о пользователях", callback_data: "admin_users" }]
            ]
        }
    };
    bot.sendMessage(chatId, "Админ панель. Выберите действия ниже:", keyboard);
}