import { addMatch } from '../models/database.js';

export async function handleAddMatch(ctx, player1_id, player2_id, score) {
  try {
    const match = await addMatch(player1_id, player2_id, score);
    return ctx.reply(`Матч добавлен! ID: ${match.rows[0].id}`);
  } catch (err) {
    console.error(err);
    return ctx.reply('Ошибка при добавлении матча.');
  }
}