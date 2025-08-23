import { Bans, Logs, Users } from '../models/database.js';

export const banUser = async (telegramId, reason, expiresAt) => {
  const { data, error } = await Bans().insert({
    user_id: telegramId,
    reason,
    expires_at: expiresAt
  });
  if (error) throw error;

  await Logs().insert({
    action: `Забанен пользователь ${telegramId}: ${reason}`,
    user_id: telegramId
  });

  return data;
};