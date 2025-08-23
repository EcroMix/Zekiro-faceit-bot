import { getUserByTelegramId, createUser } from '../models/database.js';

export default async function registrationHandler(update, chatId) {
  if (!update.message || !update.message.text) return;

  const text = update.message.text;

  if (text === '/start') {
    // Приветствие и регистрация
    // Здесь можно отправить сообщение с Telegram Bot API
    console.log(`User ${chatId} нажал /start`);
    // Реально нужно использовать fetch для Telegram API sendMessage
  }

  // Пример регистрации по никнейму и ID
  // const user = await getUserByTelegramId(chatId);
  // if (!user) await createUser(chatId, text);
}