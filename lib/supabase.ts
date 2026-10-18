import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://twtqohazvboqetyodneu.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_AHH_DluGEga3uq5P9ZlBEA_xHDW74za";

export const supabase = createClient(supabaseUrl, supabaseKey);