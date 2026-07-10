// Supabase client — optional for now. The calculator runs fully client-side;
// Supabase comes into play later for saving scenarios / auth. If the env vars
// aren't set, exports null and the app must behave normally without it.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
