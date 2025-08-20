const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// Запускаем сервер для Render
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Zekiro Faceit Bot is running!');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Запуск телеграм-бота
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

bot.setWebHook(`https://zekiro-faceit-bot.onrender.com/${token}`);

app.post(`/${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Хранилище данных (пока в памяти)
let users = {};
let bans = {};
let admins = new Set(['6005466815']); // твой id
let userStats = {};

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === "/start") {
    bot.sendMessage(chatId, "✅ Привет! Бот запущен и работает.");
  } else {
    bot.sendMessage(chatId, "📩 Ты написал: " + msg.text);
  }
});