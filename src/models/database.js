
import { supabase } from '../config/database.js';

export const Users = () => supabase.from('users');
export const Matches = () => supabase.from('matches');
export const Lobbies = () => supabase.from('lobbies');
export const Tickets = () => supabase.from('tickets');
export const Warnings = () => supabase.from('warnings');
export const Bans = () => supabase.from('bans');
export const Logs = () => supabase.from('logs');