import { addBan, addWarning, addLog } from '../models/database.js';

export async function handleBanUser(ctx, userId, reason, expiresAt) {
  try {
    await addBan(userId, reason, expiresAt);
    await addLog(`User ${userId} banned for ${reason}`);
    return ctx.reply(`Пользователь ${userId} забанен!`);
  } catch (err) {
    console.error(err);
    return ctx.reply('Ошибка при бане пользователя.');
  }
}

export async function handleWarning(ctx, userId, reason) {
  try {
    await addWarning(userId, reason);
    await addLog(`Warning issued to ${userId} for ${reason}`);
    return ctx.reply(`Пользователь ${userId} получил предупреждение.`);
  } catch (err) {
    console.error(err);
    return ctx.reply('Ошибка при выдаче предупреждения.');
  }
}