import { createLobby } from '../models/database.js';

export async function handleCreateLobby(ctx, lobbyName) {
  const telegramId = ctx.from.id;
  try {
    const lobby = await createLobby(lobbyName, telegramId);
    return ctx.reply(`Лобби "${lobbyName}" создано!`);
  } catch (err) {
    console.error(err);
    return ctx.reply('Ошибка при создании лобби.');
  }
}