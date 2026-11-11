/**
 * Copies COLLEGE_EMAIL_DOMAINS and ADMIN_EMAILS from .env into the database,
 * then re-checks everyone's verified badge. Safe to run any number of times.
 *   npm run db:sync
 */
import { listFromEnv, scriptDb } from "./script-db";

async function main() {
  const db = scriptDb();
  const domains = listFromEnv("COLLEGE_EMAIL_DOMAINS").filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  const admins = listFromEnv("ADMIN_EMAILS");

  await db.$transaction(async (tx) => {
    await tx.allowedDomain.deleteMany({ where: { domain: { notIn: domains } } });
    if (domains.length) await tx.allowedDomain.createMany({ data: domains.map((domain) => ({ domain })), skipDuplicates: true });
    await tx.$executeRaw`SELECT app.recompute_verification()`;
    await tx.$executeRaw`
      UPDATE app.profiles p SET is_admin = lower(u.email) = ANY(${admins}::text[])
      FROM auth.users u WHERE u.id = p.id`;
  });

  const [verified, adminCount] = await Promise.all([
    db.profile.count({ where: { verifiedAt: { not: null }, isDemo: false } }),
    db.profile.count({ where: { isAdmin: true } }),
  ]);
  console.log(`Allowed domains: ${domains.join(", ") || "(none: nobody can get verified)"}`);
  console.log(`Verified students: ${verified}. Admins: ${adminCount}.`);
  if (admins.length && adminCount === 0) console.log("Admin emails are set but those accounts haven't signed up yet. Run this again after they do.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
