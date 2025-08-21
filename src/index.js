require('dotenv').config(); // обязательно загружаем .env

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const registrationHandler = require("./handlers/registration");
const lobbyHandler = require("./handlers/lobby");
const matchesHandler = require("./handlers/matches");
const adminHandler = require("./handlers/admin");

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is missing in .env");
}

const bot = new TelegramBot(token, { polling: true });
const app = express();

// подключаем хендлеры
registrationHandler(bot);
lobbyHandler(bot);
matchesHandler(bot);
adminHandler(bot);

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});