import { createUser, getUserByTelegramId } from '../models/database.js';

export async function handleRegistration(ctx) {
  const telegramId = ctx.from.id;
  const username = ctx.from.username;

  const existingUser = await getUserByTelegramId(telegramId);
  if (existingUser) {
    return ctx.reply('Вы уже зарегистрированы.');
  }

  try {
    await createUser(telegramId, username);
    return ctx.reply(`Регистрация успешна! Ваш никнейм: ${username}`);
  } catch (err) {
    console.error(err);
    return ctx.reply('Ошибка при регистрации. Попробуйте позже.');
  }
}