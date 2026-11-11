import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./client";

export type Viewer = { id: string; email?: string };
export type Tx = Prisma.TransactionClient;

/**
 * Runs `fn` inside a transaction that impersonates the signed-in user (or anon),
 * exactly the way Supabase's own API does: Postgres then applies the same RLS
 * policies to these queries as it does to Storage and Realtime.
 * The settings are transaction-local, so this is safe on a transaction pooler.
 */
export function withRls<T>(viewer: Viewer | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const role = viewer ? "authenticated" : "anon";
  const claims = JSON.stringify(viewer ? { sub: viewer.id, role, email: viewer.email } : { role });
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true), set_config('role', ${role}, true)`;
    return fn(tx);
  });
}
