import express from 'express';
import { config } from 'dotenv';
config();

import { supabase } from './config/database.js';

import registrationHandler from './handlers/registration.js';
import lobbyHandler from './handlers/lobbies.js';
import matchesHandler from './handlers/matches.js';
import adminHandler from './handlers/admin.js';
import bansHandler from './handlers/bans.js';
import ticketsHandler from './handlers/tickets.js';
import warningsHandler from './handlers/warnings.js';

const app = express();
app.use(express.json());

// --- Роут для Telegram webhook ---
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  const update = req.body;

  // Тут вызываем разные хэндлеры в зависимости от типа update
  try {
    if (update.message) {
      const msg = update.message;
      // регистрация
      await registrationHandler(msg, supabase);
      // другие обработчики (при необходимости)
      await lobbyHandler(msg, supabase);
      await matchesHandler(msg, supabase);
      await adminHandler(msg, supabase);
      await bansHandler(msg, supabase);
      await ticketsHandler(msg, supabase);
      await warningsHandler(msg, supabase);
    } else if (update.callback_query) {
      const query = update.callback_query;
      // обработка нажатий inline кнопок
      await lobbyHandler(query, supabase, true);
      await matchesHandler(query, supabase, true);
      await adminHandler(query, supabase, true);
      await bansHandler(query, supabase, true);
      await ticketsHandler(query, supabase, true);
      await warningsHandler(query, supabase, true);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Ошибка при обработке update:', err);
    res.sendStatus(500);
  }
});

// --- Роут для проверки работы сервера ---
app.get('/', (req, res) => {
  res.send('Zekiro Faceit Bot is running!');
});

// --- Запуск сервера ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});