import 'dotenv/config';
import pkg from '@supabase/supabase-js';

const { createClient } = pkg;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL is missing in .env");
if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in .env");

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);