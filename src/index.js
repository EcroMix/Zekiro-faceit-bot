import express from 'express';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { handleRegistration } from './handlers/registration.js';

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(handleRegistration);

app.use(express.json());
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Bot is running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));