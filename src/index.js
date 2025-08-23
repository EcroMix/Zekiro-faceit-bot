import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";

import registrationHandler from "./handlers/registration.js";
import matchesHandler from "./handlers/matches.js";
import lobbyHandler from "./handlers/lobbies.js";
import adminHandler from "./handlers/admin.js";
import bansHandler from "./handlers/bans.js";
import ticketsHandler from "./handlers/tickets.js";
import warningsHandler from "./handlers/warnings.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// подключаем хендлеры
registrationHandler(bot);
matchesHandler(bot);
lobbyHandler(bot);
adminHandler(bot);
bansHandler(bot);
ticketsHandler(bot);
warningsHandler(bot);

// express для рендера
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});