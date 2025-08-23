import { Lobbies } from '../models/database.js';

export const createLobby = async (ctx, name, ownerId) => {
  const { data, error } = await Lobbies().insert({
    name,
    owner_id: ownerId
  });
  if (error) throw error;
  return data;
};