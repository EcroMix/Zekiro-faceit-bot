const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const registrationHandler = require("./handlers/registration");
const lobbyHandler = require("./handlers/lobby");
const matchesHandler = require("./handlers/matches");
const adminHandler = require("./handlers/admin");

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const PORT = process.env.PORT || 10000;

const bot = new TelegramBot(BOT_TOKEN);

// Настройка webhook
bot.setWebHook(`${APP_URL}/bot${BOT_TOKEN}`);

// Endpoint для Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Подключаем обработчики
registrationHandler(bot);
lobbyHandler(bot);
matchesHandler(bot);
adminHandler(bot);

// Старт сервера
app.listen(PORT, () => {
  console.log(`Bot listening on port ${PORT}`);
});