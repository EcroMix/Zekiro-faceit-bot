import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf } from 'telegraf';
import { handleRegistration } from './handlers/registration.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.APP_URL + '/bot' + process.env.TELEGRAM_BOT_TOKEN;

// Регистрация стартового хендлера
bot.start(async (ctx) => {
  await handleRegistration(ctx);
});

// Устанавливаем webhook
bot.telegram.setWebhook(WEBHOOK_URL);

// Пробрасываем обновления через Express
app.use(bot.webhookCallback('/bot' + process.env.TELEGRAM_BOT_TOKEN));

// Тестовый root
app.get('/', (req, res) => {
  res.send('Бот работает через вебхук!');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});