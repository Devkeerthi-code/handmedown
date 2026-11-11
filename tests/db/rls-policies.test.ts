import { describe, expect, it } from "vitest";
import { as, asOwner, attempt, createListing, createUser, sql, withTestDatabase } from "./helpers";

withTestDatabase();

it("RLS is switched on for every table in the app schema", async () => {
  const rows = await sql<{ relname: string; relrowsecurity: boolean }>(
    `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'app' AND c.relkind = 'r'`,
  );
  expect(rows.length).toBeGreaterThanOrEqual(13);
  expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
});

describe("visibility", () => {
  it("anon sees visible listings but never hidden ones", async () => {
    const seller = await createUser();
    const visible = await createListing(seller, { title: "Visible" });
    const hidden = await createListing(seller, { title: "Hidden", hidden: true });
    await as(null);
    const ids = (await sql<{ id: string }>("SELECT id FROM app.listings WHERE id = ANY($1)", [[visible, hidden]])).map((r) => r.id);
    expect(ids).toEqual([visible]);
  });

  it("the owner and admins can still see a hidden listing", async () => {
    const seller = await createUser();
    const admin = await createUser({ admin: true });
    const hidden = await createListing(seller, { hidden: true });
    for (const u of [seller, admin]) {
      await as(u);
      expect(await sql("SELECT id FROM app.listings WHERE id = $1", [hidden])).toHaveLength(1);
    }
  });
});

describe("reports", () => {
  it("reporting a listing hides it immediately, pending review", async () => {
    const seller = await createUser();
    const reporter = await createUser();
    const id = await createListing(seller);
    await as(reporter);
    expect((await attempt("INSERT INTO app.reports (reporter_id, listing_id, reason) VALUES ($1, $2, 'scam')", [reporter.id, id])).ok).toBe(true);
    expect(await sql("SELECT id FROM app.listings WHERE id = $1", [id])).toHaveLength(0);
    await asOwner();
    const [row] = await sql<{ is_hidden: boolean }>("SELECT is_hidden FROM app.listings WHERE id = $1", [id]);
    expect(row.is_hidden).toBe(true);
  });

  it("you can't report the same listing twice while it's open", async () => {
    const seller = await createUser();
    const reporter = await createUser();
    const id = await createListing(seller);
    await as(reporter);
    await attempt("INSERT INTO app.reports (reporter_id, listing_id, reason) VALUES ($1, $2, 'spam')", [reporter.id, id]);
    expect((await attempt("INSERT INTO app.reports (reporter_id, listing_id, reason) VALUES ($1, $2, 'spam')", [reporter.id, id])).ok).toBe(false);
  });

  it("students see only their own reports; admins see all and resolve them", async () => {
    const seller = await createUser();
    const a = await createUser();
    const b = await createUser();
    const admin = await createUser({ admin: true });
    const id = await createListing(seller);
    await sql("INSERT INTO app.reports (reporter_id, listing_id, reason) VALUES ($1, $2, 'misleading')", [a.id, id]);
    await as(b);
    expect(await sql("SELECT id FROM app.reports")).toHaveLength(0);
    expect((await attempt("UPDATE app.reports SET status = 'dismissed'")).rowCount).toBe(0);
    await as(admin);
    expect(await sql("SELECT id FROM app.reports")).toHaveLength(1);
    expect((await attempt("UPDATE app.reports SET status = 'dismissed'")).rowCount).toBe(1);
  });

  it("a reporter can't file a report pre-marked as resolved", async () => {
    const seller = await createUser();
    const reporter = await createUser();
    const id = await createListing(seller);
    await as(reporter);
    const r = await attempt("INSERT INTO app.reports (reporter_id, listing_id, reason, status) VALUES ($1, $2, 'scam', 'dismissed')", [reporter.id, id]);
    expect(r.ok).toBe(false);
  });
});

describe("profiles", () => {
  it("you can rename yourself but not make yourself admin, verified or unbanned", async () => {
    const me = await createUser({ college: false });
    await as(me);
    expect((await attempt("UPDATE app.profiles SET display_name = 'New Name' WHERE id = $1", [me.id])).rowCount).toBe(1);
    for (const col of ["is_admin = true", "verified_at = now()", "banned_at = NULL"]) {
      expect((await attempt(`UPDATE app.profiles SET ${col} WHERE id = $1`, [me.id])).ok).toBe(false);
    }
  });

  it("you can't rename someone else", async () => {
    const me = await createUser();
    const other = await createUser();
    await as(me);
    expect((await attempt("UPDATE app.profiles SET display_name = 'Gotcha' WHERE id = $1", [other.id])).rowCount).toBe(0);
  });

  it("subdomains of an allowed college domain also verify", async () => {
    await sql(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@cse.test.edu.in', '', now(), '{}', '{}', now(), now())`,
    );
    const [p] = await sql<{ verified: boolean }>(
      "SELECT p.verified_at IS NOT NULL AS verified FROM app.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email = 'x@cse.test.edu.in'",
    );
    expect(p.verified).toBe(true);
  });
});

describe("private tables", () => {
  it("usage events and allowed domains are invisible to every client role", async () => {
    const me = await createUser();
    for (const who of [me, null]) {
      await as(who);
      expect((await attempt("SELECT * FROM app.usage_events")).ok).toBe(false);
      expect((await attempt("SELECT * FROM app.allowed_domains")).ok).toBe(false);
      expect((await attempt("INSERT INTO app.allowed_domains (domain) VALUES ('evil.com')")).ok).toBe(false);
    }
  });

  it("wishlist alerts and push subscriptions are private to their owner", async () => {
    const me = await createUser();
    const other = await createUser();
    await sql("INSERT INTO app.wishlist_alerts (user_id, query) VALUES ($1, 'cycle')", [other.id]);
    await sql("INSERT INTO app.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, https://push.example/x, kkkkkkkkkkkkkkkkkkkk, aaaaaaaaaa)", [other.id]);
    await as(me);
    expect(await sql("SELECT id FROM app.wishlist_alerts")).toHaveLength(0);
    expect(await sql("SELECT id FROM app.push_subscriptions")).toHaveLength(0);
    expect((await attempt("INSERT INTO app.wishlist_alerts (user_id, query) VALUES ($1, 'x')", [other.id])).ok).toBe(false);
  });

  it("activity is tracked by triggers, with no IPs or content", async () => {
    const seller = await createUser();
    await createListing(seller);
    const cols = (await sql<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'usage_events'",
    )).map((c) => c.column_name).sort();
    expect(cols).toEqual(["created_at", "event", "id", "user_id"]);
    const events = (await sql<{ event: string }>("SELECT event::text FROM app.usage_events WHERE user_id = $1", [seller.id])).map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(["signup", "verified", "listing_created"]));
  });
});

describe("storage bucket", () => {
  it("is limited to 1 MB WebP/JPEG", async () => {
    const [b] = await sql<{ file_size_limit: number; allowed_mime_types: string[]; public: boolean }>(
      "SELECT file_size_limit, allowed_mime_types, public FROM storage.buckets WHERE id = 'listing-photos'",
    );
    expect(Number(b.file_size_limit)).toBe(1048576);
    expect(b.allowed_mime_types.sort()).toEqual(["image/jpeg", "image/webp"]);
  });

  it("verified users may upload only into their own folder; unverified users not at all", async () => {
    const me = await createUser();
    const other = await createUser();
    const unverified = await createUser({ college: false });
    const put = (owner: string, folder: string) =>
      attempt(
        "INSERT INTO storage.objects (bucket_id, name, owner_id, metadata) VALUES ('listing-photos', $1, $2, '{}'::jsonb)",
        [`${folder}/${crypto.randomUUID()}.webp`, owner],
      );
    await as(me);
    expect((await put(me.id, me.id)).ok).toBe(true);
    expect((await put(me.id, other.id)).ok).toBe(false);
    await as(unverified);
    expect((await put(unverified.id, unverified.id)).ok).toBe(false);
  });
});
