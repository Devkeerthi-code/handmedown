import { thumbPathOf } from "@/lib/images/rules";

const BUCKET = "listing-photos";

export function photoUrl(path: string, size: "full" | "thumb" = "full") {
  const p = size === "thumb" ? thumbPathOf(path) : path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
}

export { BUCKET as PHOTO_BUCKET };
