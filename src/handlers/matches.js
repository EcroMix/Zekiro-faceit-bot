import { Matches } from '../models/database.js';

export const addMatch = async (matchData) => {
  const { data, error } = await Matches().insert(matchData);
  if (error) throw error;
  return data;
};