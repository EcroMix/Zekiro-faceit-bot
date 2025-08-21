require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

// Хендлеры
const registrationHandler = require('./handlers/registration');
const lobbyHandler = require('./handlers/lobby');
const matchesHandler = require('./handlers/matches');
const adminHandler = require('./handlers/admin');

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is missing in .env");

const bot = new TelegramBot(token); // без polling

// Express
const app = express();
app.use(bodyParser.json());

// Проверка переменных Render
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (!RENDER_URL) throw new Error("RENDER_EXTERNAL_URL is missing in .env");

// Путь webhook
const webhookPath = `/webhook/${token}`;
const webhookURL = `https://${RENDER_URL}${webhookPath}`;

// Установка webhook
bot.setWebHook(webhookURL)
  .then(() => console.log('✅ Webhook установлен:', webhookURL))
  .catch(console.error);

// Endpoint Telegram
app.post(webhookPath, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Тестовая страница
app.get('/', (req, res) => {
  res.send('Bot is running via webhook 🚀');
});

// Подключаем хендлеры
registrationHandler(bot);
lobbyHandler(bot);
matchesHandler(bot);
adminHandler(bot);

// Старт сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));