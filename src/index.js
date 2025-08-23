import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import 'dotenv/config';

import registrationHandler from './handlers/registration.js';
import lobbyHandler from './handlers/lobbies.js';
import matchesHandler from './handlers/matches.js';
import adminHandler from './handlers/admin.js';
import bansHandler from './handlers/bans.js';
import ticketsHandler from './handlers/tickets.js';
import warningsHandler from './handlers/warnings.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Webhook endpoint для Telegram ---
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    
    // Основная обработка команд
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Регистрация
      await registrationHandler(update, chatId);

      // Лобби
      await lobbyHandler(update, chatId);

      // Матчи
      await matchesHandler(update, chatId);

      // Админ
      await adminHandler(update, chatId);

      // Баны
      await bansHandler(update, chatId);

      // Тикеты
      await ticketsHandler(update, chatId);

      // Предупреждения
      await warningsHandler(update, chatId);
    }

    res.status(200).send({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ ok: false, error: err.message });
  }
});

// --- Health check для Render ---
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});