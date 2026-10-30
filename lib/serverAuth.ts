// Server-only: checks who is calling an API route and which properties they own.
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://twtqohazvboqetyodneu.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_AHH_DluGEga3uq5P9ZlBEA_xHDW74za";

export async function getCallerFromRequest(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return null;
  }

  // Client that acts as the logged-in user, so database security rules apply.
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return { userClient, user: data.user };
}

export async function userOwnsProperty(
  userClient: SupabaseClient,
  userId: string,
  propertyId: string
) {
  const { data, error } = await userClient
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("landlord_id", userId)
    .maybeSingle();

  return !error && !!data;
}
