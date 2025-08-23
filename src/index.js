import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";

import { registerUser } from "./handlers/registration.js";
import { handleMatch } from "./handlers/matches.js";
import { handleLobby } from "./handlers/lobbies.js";
import { handleTicket } from "./handlers/tickets.js";
import { handleWarning } from "./handlers/warnings.js";
import { handleBan } from "./handlers/bans.js";
import { handleAdmin } from "./handlers/admin.js";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

// Хендлеры
bot.onText(/\/start/, (msg) => registerUser(bot, msg));
bot.onText(/\/match/, (msg) => handleMatch(bot, msg));
bot.onText(/\/lobby/, (msg) => handleLobby(bot, msg));
bot.onText(/\/ticket/, (msg) => handleTicket(bot, msg));
bot.onText(/\/warn/, (msg) => handleWarning(bot, msg));
bot.onText(/\/ban/, (msg) => handleBan(bot, msg));
bot.onText(/\/admin/, (msg) => handleAdmin(bot, msg));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));