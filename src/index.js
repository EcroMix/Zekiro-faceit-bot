
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import dotenv from "dotenv";
import { supabase } from "./config/database.js";

dotenv.config();

// Telegram bot init
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Express server (для Render)
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Test command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Привет! Faceit бот запущен 🚀");
});