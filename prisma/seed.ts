/**
 * Adds clearly labelled DEMO sellers and listings. Re-running replaces them.
 *   npm run db:seed      (remove with npm run db:unseed)
 * Demo accounts get random passwords that are never stored or printed, so nobody can sign in as them.
 */
import { randomBytes } from "node:crypto";
import { scriptDb, scriptSupabaseAdmin } from "../scripts/script-db";
import { removeDemoUsers } from "./unseed";
import { DEMO_LISTINGS, DEMO_NOTE, DEMO_SELLERS } from "./demo-data";

async function main() {
  const db = scriptDb();
  const supabase = scriptSupabaseAdmin();

  const removed = await removeDemoUsers(supabase);
  if (removed) console.log(`Removed ${removed} old demo accounts.`);

  const sellerIds = new Map<string, string>();
  for (const seller of DEMO_SELLERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `demo-${seller.key}@example.com`,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
      app_metadata: { hmd_demo: true },
      user_metadata: { display_name: seller.name },
    });
    if (error || !data.user) throw new Error(`Couldn't create demo seller ${seller.key}: ${error?.message}`);
    sellerIds.set(seller.key, data.user.id);
  }

  const now = Date.now();
  await db.listing.createMany({
    data: DEMO_LISTINGS.map((l) => ({
      sellerId: sellerIds.get(l.seller)!,
      title: l.title,
      description: l.description + DEMO_NOTE,
      category: l.category,
      condition: l.condition,
      priceType: l.priceType,
      price: l.price ?? null,
      originalPrice: l.originalPrice ?? null,
      exchangeFor: l.exchangeFor ?? null,
      pickupSpot: l.pickupSpot,
      status: l.status ?? "active",
      isDemo: true,
      isbn: l.isbn ?? null,
      bookSemester: l.bookSemester ?? null,
      bookSubject: l.bookSubject ?? null,
      bookAuthor: l.bookAuthor ?? null,
      createdAt: new Date(now - l.hoursAgo * 3600_000),
    })),
  });

  console.log(`Seeded ${DEMO_SELLERS.length} demo sellers and ${DEMO_LISTINGS.length} DEMO listings.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
