/**
 * Copies ADMIN_EMAILS from .env into the database (platform admins). Safe to run any number of times.
 * College domains live in the database and are managed from the website.
 *   npm run db:sync
 */
import { listFromEnv, scriptDb } from "./script-db";

async function main() {
  const db = scriptDb();
  const admins = listFromEnv("ADMIN_EMAILS");
  await db.$executeRaw`
    UPDATE app.profiles p SET is_admin = lower(u.email) = ANY(${admins}::text[])
    FROM auth.users u WHERE u.id = p.id`;
  const adminCount = await db.profile.count({ where: { isAdmin: true } });
  console.log(`Platform admins: ${adminCount}.`);
  if (admins.length && adminCount === 0) {
    console.log("ADMIN_EMAILS is set but those accounts haven't signed up yet. Run this again after they do.");
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
