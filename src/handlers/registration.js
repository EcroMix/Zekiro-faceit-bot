import { createUser, getUserByTelegramId } from "../models/database.js";

export async function registerUser(bot, msg) {
  const chatId = msg.chat.id;
  const username = msg.from.username || "NoName";
  const telegramId = msg.from.id;

  let user = await getUserByTelegramId(telegramId);

  if (!user) {
    await createUser(telegramId, username);
    bot.sendMessage(chatId, `✅ Добро пожаловать, ${username}! Ты зарегистрирован.`);
  } else {
    bot.sendMessage(chatId, `⚡ Привет, ${username}! Ты уже есть в базе.`);
  }
}