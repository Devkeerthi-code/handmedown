/**
 * Database tests run against your real Supabase database, but every test runs
 * inside a transaction that is ROLLED BACK, so nothing is ever left behind.
 * `as(user)` switches to the same role + JWT claims Supabase uses, so the real
 * RLS policies, grants and triggers are what's being tested.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

export type TestUser = { id: string; email: string; collegeId: string | null };

/** Two test colleges, created inside every (rolled-back) test transaction. */
export const COLLEGE_A = "a0000000-0000-4000-8000-0000000000aa";
export const COLLEGE_B = "b0000000-0000-4000-8000-0000000000bb";
const DOMAIN = { a: "test.edu.in", b: "other-test.ac.in" } as const;

let client: Client;

export function withTestDatabase() {
  beforeAll(async () => {
    const url = process.env.DIRECT_URL;
    if (!url) throw new Error("DB tests need DIRECT_URL in .env");
    client = new Client({ connectionString: url });
    await client.connect();
  });
  afterAll(async () => client?.end());
  beforeEach(async () => {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app.colleges (id, name, short_name, slug, accent, pickup_spots)
       VALUES ($1, 'Test College A', 'TCA', 'test-college-a', '#1F7A8C', ARRAY['Central Library', 'Main Gate']),
              ($2, 'Test College B', 'TCB', 'test-college-b', '#8C1D40', ARRAY['Central Library', 'North Gate'])`,
      [COLLEGE_A, COLLEGE_B],
    );
    await client.query(
      "INSERT INTO app.college_domains (domain, college_id, status) VALUES ($1, $2, 'active'), ($3, $4, 'active')",
      [DOMAIN.a, COLLEGE_A, DOMAIN.b, COLLEGE_B],
    );
  });
  afterEach(async () => {
    await client.query("ROLLBACK");
  });
}

export async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const res = await client.query(text, values);
  return res.rows as T[];
}

/** Runs `text` and reports whether Postgres refused it (RLS / grants / checks), without aborting the test transaction. */
export async function attempt(text: string, values: unknown[] = []) {
  await client.query("SAVEPOINT attempt");
  try {
    const res = await client.query(text, values);
    await client.query("RELEASE SAVEPOINT attempt");
    return { ok: true as const, rows: res.rows, rowCount: res.rowCount ?? 0 };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT attempt");
    return { ok: false as const, error: (error as Error).message, rows: [], rowCount: 0 };
  }
}

/** Hides every pre-existing listing and pauses every alert (inside the rolled-back transaction) so tests only see their own data. */
export async function isolateCatalogue() {
  await sql("UPDATE app.listings SET is_hidden = true WHERE NOT is_hidden");
  await sql("UPDATE app.wishlist_alerts SET active = false WHERE active");
}

/** Creates an Auth user (which fires the profile trigger). College-domain users come out verified. */
type UserOpts = {
  /** "a" (default) or "b" = member of that test college; false = personal email, member of nothing. */
  college?: "a" | "b" | false;
  admin?: boolean;
  role?: "admin" | "moderator";
  name?: string;
  confirmed?: boolean;
  domain?: string;
};

export async function createUser(opts: UserOpts = {}): Promise<TestUser> {
  const id = randomUUID();
  const key = opts.college === undefined ? "a" : opts.college;
  const domain = opts.domain ?? (key === false ? "gmail.com" : DOMAIN[key]);
  const email = `${id.slice(0, 8)}@${domain}`;
  await sql(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '',
             CASE WHEN $4 THEN now() END,
             '{}'::jsonb, jsonb_build_object('display_name', $3::text), now(), now())`,
    [id, email, opts.name ?? "Test Student", opts.confirmed !== false],
  );
  if (opts.admin) await sql("UPDATE app.profiles SET is_admin = true WHERE id = $1", [id]);
  const [p] = await sql<{ college_id: string | null }>("SELECT college_id FROM app.profiles WHERE id = $1", [id]);
  if (opts.role && p.college_id) {
    await sql("INSERT INTO app.college_roles (college_id, user_id, role) VALUES ($1, $2, $3::app.\"CollegeRole\")", [p.college_id, id, opts.role]);
  }
  return { id, email, collegeId: p.college_id };
}

/** Act as a signed-in user (or anon) for the following statements. */
export async function as(user: TestUser | null) {
  const role = user ? "authenticated" : "anon";
  const claims = JSON.stringify(user ? { sub: user.id, role, email: user.email } : { role });
  await sql("SELECT set_config('request.jwt.claims', $1, true), set_config('role', $2, true)", [claims, role]);
}

/** Back to the owner role for setup steps. */
export async function asOwner() {
  await sql("RESET ROLE");
  await sql("SELECT set_config('request.jwt.claims', '', true)");
}

type ListingOpts = {
  collegeId?: string;
  title?: string;
  category?: string;
  priceType?: "fixed" | "free" | "exchange";
  price?: number | null;
  status?: "active" | "reserved" | "sold";
  isbn?: string | null;
  description?: string;
  createdAt?: string;
  hidden?: boolean;
};

/** Inserts a listing as the owner role (setup only; RLS-checked inserts are tested separately). */
export async function createListing(seller: TestUser, o: ListingOpts = {}) {
  const priceType = o.priceType ?? "fixed";
  const [row] = await sql<{ id: string }>(
    `INSERT INTO app.listings (seller_id, title, description, category, condition, price_type, price,
                               pickup_spot, status, isbn, is_hidden, created_at, updated_at, college_id)
     VALUES ($1, $2, $3, $4::app."Category", 'good', $5::app."PriceType", $6, 'Central Library',
             $7::app."ListingStatus", $8, $9, coalesce($10::timestamptz, now()), now(), $11)
     RETURNING id`,
    [
      seller.id,
      o.title ?? "Test item",
      o.description ?? "",
      o.category ?? (o.isbn ? "books" : "other"),
      priceType,
      priceType === "fixed" ? (o.price ?? 500) : null,
      o.status ?? "active",
      o.isbn ?? null,
      o.hidden ?? false,
      o.createdAt ?? null,
      o.collegeId ?? seller.collegeId ?? COLLEGE_A,
    ],
  );
  return row.id;
}

export async function createConversation(listingId: string, buyer: TestUser, seller: TestUser) {
  const [row] = await sql<{ id: string }>(
    `INSERT INTO app.conversations (listing_id, buyer_id, seller_id, college_id)
     SELECT $1, $2, $3, l.college_id FROM app.listings l WHERE l.id = $1 RETURNING id`,
    [listingId, buyer.id, seller.id],
  );
  return row.id;
}
