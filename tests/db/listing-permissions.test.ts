import { describe, expect, it } from "vitest";
import { as, asOwner, attempt, createListing, createUser, sql, withTestDatabase } from "./helpers";

withTestDatabase();

const insertListing = (sellerId: string) =>
  attempt(
    `INSERT INTO app.listings (seller_id, title, category, condition, price_type, price, pickup_spot)
     VALUES ($1, 'Casio calculator', 'electronics', 'good', 'fixed', 600, 'Central Library') RETURNING id`,
    [sellerId],
  );

describe("who can post", () => {
  it("a verified student can post their own listing", async () => {
    const me = await createUser();
    await as(me);
    const r = await insertListing(me.id);
    expect(r.ok).toBe(true);
  });

  it("an unverified account (non-college email) can browse but not post", async () => {
    const me = await createUser({ college: false });
    const [profile] = await sql<{ verified_at: Date | null }>("SELECT verified_at FROM app.profiles WHERE id = $1", [me.id]);
    expect(profile.verified_at).toBeNull();
    await as(me);
    expect((await sql("SELECT id FROM app.listings LIMIT 1")).length).toBeGreaterThanOrEqual(0);
    const r = await insertListing(me.id);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/row-level security/);
  });

  it("nobody can post as someone else", async () => {
    const me = await createUser();
    const victim = await createUser();
    await as(me);
    expect((await insertListing(victim.id)).ok).toBe(false);
  });

  it("a banned student can't post", async () => {
    const me = await createUser();
    await sql("UPDATE app.profiles SET banned_at = now() WHERE id = $1", [me.id]);
    await as(me);
    expect((await insertListing(me.id)).ok).toBe(false);
  });

  it("anon can't post at all", async () => {
    const me = await createUser();
    await as(null);
    expect((await insertListing(me.id)).ok).toBe(false);
  });

  it("users can't create pre-hidden or demo listings to game the system", async () => {
    const me = await createUser();
    await as(me);
    const r = await attempt(
      `INSERT INTO app.listings (seller_id, title, category, condition, price_type, price, pickup_spot, is_demo)
       VALUES ($1, 'Fake demo', 'other', 'good', 'free', NULL, 'Main Gate', true)`,
      [me.id],
    );
    expect(r.ok).toBe(false);
  });
});

describe("only the owner edits a listing", () => {
  it("the owner can edit and mark it sold", async () => {
    const owner = await createUser();
    const id = await createListing(owner);
    await as(owner);
    const r = await attempt("UPDATE app.listings SET title = 'New title', status = 'sold' WHERE id = $1", [id]);
    expect(r.rowCount).toBe(1);
  });

  it("another student's UPDATE and DELETE silently match nothing", async () => {
    const owner = await createUser();
    const other = await createUser();
    const id = await createListing(owner, { price: 900 });
    await as(other);
    expect((await attempt("UPDATE app.listings SET price = 1 WHERE id = $1", [id])).rowCount).toBe(0);
    expect((await attempt("DELETE FROM app.listings WHERE id = $1", [id])).rowCount).toBe(0);
    await asOwner();
    const [row] = await sql<{ price: number }>("SELECT price FROM app.listings WHERE id = $1", [id]);
    expect(row.price).toBe(900);
  });

  it("the owner can't hand the listing to someone else or flip is_demo", async () => {
    const owner = await createUser();
    const other = await createUser();
    const id = await createListing(owner);
    await as(owner);
    expect((await attempt("UPDATE app.listings SET seller_id = $2 WHERE id = $1", [id, other.id])).ok).toBe(false);
    expect((await attempt("UPDATE app.listings SET is_demo = true WHERE id = $1", [id])).ok).toBe(false);
  });

  it("a reported (hidden) listing can only be restored by an admin", async () => {
    const owner = await createUser();
    const admin = await createUser({ admin: true });
    const id = await createListing(owner, { hidden: true });
    await as(owner);
    const r = await attempt("UPDATE app.listings SET is_hidden = false WHERE id = $1", [id]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Only an admin/);
    await as(admin);
    expect((await attempt("UPDATE app.listings SET is_hidden = false WHERE id = $1", [id])).rowCount).toBe(1);
  });

  it("database checks reject impossible prices even from the owner", async () => {
    const owner = await createUser();
    const id = await createListing(owner);
    await as(owner);
    expect((await attempt("UPDATE app.listings SET price = -10 WHERE id = $1", [id])).ok).toBe(false);
    expect((await attempt("UPDATE app.listings SET price_type = 'free' WHERE id = $1", [id])).ok).toBe(false); // free must have no price
  });
});

describe("photos follow their listing", () => {
  it("only the listing owner can attach photos, and only from their own folder", async () => {
    const owner = await createUser();
    const other = await createUser();
    const id = await createListing(owner);
    const photo = (uid: string) => `${uid}/${crypto.randomUUID()}.webp`;
    const insert = (path: string) =>
      attempt("INSERT INTO app.listing_photos (listing_id, storage_path, position, width, height) VALUES ($1, $2, 0, 800, 600)", [id, path]);

    await as(other);
    expect((await insert(photo(other.id))).ok).toBe(false);
    await as(owner);
    expect((await insert(photo(other.id))).ok).toBe(false);
    expect((await insert(photo(owner.id))).ok).toBe(true);
  });
});

it("a listing allows at most 5 photos (positions 0-4)", async () => {
  const owner = await createUser();
  const id = await createListing(owner);
  const r = await attempt(
    "INSERT INTO app.listing_photos (listing_id, storage_path, position, width, height) VALUES ($1, $2, 5, 10, 10)",
    [id, `${owner.id}/${crypto.randomUUID()}.webp`],
  );
  expect(r.ok).toBe(false);
});
