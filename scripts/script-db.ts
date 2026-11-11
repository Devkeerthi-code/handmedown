import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";

/** Scripts talk to the database over the direct connection, as the owner. */
export function scriptDb() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
}

export function scriptSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function listFromEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}
