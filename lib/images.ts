// Works out the public web address of a property photo.
// New photos live in Cloudflare R2 (their path starts with "r2/").
// Older photos still live in Supabase Storage, so they keep working.
import { supabase } from "./supabase";

const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(
  /\/+$/,
  ""
);

export const R2_PREFIX = "r2/";

export function getImageUrl(storagePath: string): string {
  if (!storagePath) {
    return "";
  }

  const cleanPath = storagePath.replace(/^\/+/, "");

  if (cleanPath.startsWith(R2_PREFIX)) {
    return `${R2_PUBLIC_URL}/${cleanPath.slice(R2_PREFIX.length)}`;
  }

  const { data } = supabase.storage
    .from("property-images")
    .getPublicUrl(cleanPath);

  return data.publicUrl;
}
