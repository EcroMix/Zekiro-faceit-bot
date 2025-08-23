import { Users } from '../models/database.js';
import { Markup } from 'telegraf';

export const handleRegistration = async (ctx) => {
  try {
    const user = ctx.from;

    const { data, error } = await Users().select().eq('telegram_id', user.id);
    if (error) throw error;

    if (data.length === 0) {
      await Users().insert({
        telegram_id: user.id,
        username: user.username || user.first_name
      });
    }

    await ctx.reply(`Привет, ${user.first_name}! Выберите действие:`, Markup.inlineKeyboard([
      [Markup.button.callback('Найти матч', 'find_match')],
      [Markup.button.callback('Профиль', 'profile')],
      [Markup.button.callback('Рейтинг игроков', 'rating')],
      [Markup.button.callback('Команды', 'teams')],
      [Markup.button.callback('Создать тикет', 'ticket')]
    ]));
  } catch (err) {
    console.error(err);
    await ctx.reply('Ошибка при регистрации. Попробуйте позже.');
  }
};