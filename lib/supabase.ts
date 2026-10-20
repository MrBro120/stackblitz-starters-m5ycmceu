import { createClient } from "@supabase/supabase-js";

// Uses environment settings if they exist (for example on Vercel),
// otherwise falls back to the values below, so it always works.
// The publishable key is safe to be public. Keep Row Level Security
// turned on in Supabase to protect your data.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://twtqohazvboqetyodneu.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_AHH_DluGEga3uq5P9ZlBEA_xHDW74za";

export const supabase = createClient(supabaseUrl, supabaseKey);
