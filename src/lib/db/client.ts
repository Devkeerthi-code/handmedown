import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  // `pgbouncer=true` is a Prisma-engine hint; node-postgres doesn't need it.
  url.searchParams.delete("pgbouncer");
  const adapter = new PrismaPg({ connectionString: url.toString(), max: 5 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Connects as the database owner. Only use directly for trusted server work; prefer withRls. */
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
