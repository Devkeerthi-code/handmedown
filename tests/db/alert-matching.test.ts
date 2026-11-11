import { beforeEach, describe, expect, it } from "vitest";
import { createListing, createUser, isolateCatalogue, sql, withTestDatabase, type TestUser } from "./helpers";

withTestDatabase();
beforeEach(isolateCatalogue);

type AlertOpts = { query?: string; category?: string; maxPrice?: number; freeOnly?: boolean; active?: boolean };

async function alert(user: TestUser, o: AlertOpts) {
  const [row] = await sql<{ id: string }>(
    `INSERT INTO app.wishlist_alerts (user_id, query, category, max_price, free_only, active)
     VALUES ($1, $2, $3::app."Category", $4, $5, $6) RETURNING id`,
    [user.id, o.query ?? null, o.category ?? null, o.maxPrice ?? null, o.freeOnly ?? false, o.active ?? true],
  );
  return row.id;
}

async function matches(listingId: string) {
  return (await sql<{ alert_id: string }>("SELECT alert_id FROM app.match_alerts($1)", [listingId])).map((r) => r.alert_id).sort();
}

describe("wishlist alert matching", () => {
  it("'cycle under ₹2000' matches a ₹1,800 cycle but not a ₹2,500 one", async () => {
    const seller = await createUser();
    const me = await createUser();
    const a = await alert(me, { query: "cycle", maxPrice: 2000 });
    const cheap = await createListing(seller, { title: "Hercules cycle", category: "cycles", price: 1800 });
    const pricey = await createListing(seller, { title: "Geared cycle", category: "cycles", price: 2500 });
    expect(await matches(cheap)).toEqual([a]);
    expect(await matches(pricey)).toEqual([]);
  });

  it("matches on category, free-only and keyword prefixes", async () => {
    const seller = await createUser();
    const me = await createUser();
    const anyBook = await alert(me, { category: "books" });
    const freeStuff = await alert(me, { freeOnly: true });
    const calc = await alert(me, { query: "calc" });
    const book = await createListing(seller, { title: "Thermodynamics", category: "books", price: 200 });
    const freeCoat = await createListing(seller, { title: "Lab coat", category: "lab", priceType: "free" });
    const calculator = await createListing(seller, { title: "Scientific calculator", category: "electronics", price: 500 });
    expect(await matches(book)).toEqual([anyBook]);
    expect(await matches(freeCoat)).toEqual([freeStuff]);
    expect(await matches(calculator)).toEqual([calc]);
  });

  it("matches a book by ISBN", async () => {
    const seller = await createUser();
    const me = await createUser();
    const a = await alert(me, { query: "9788174091956" });
    const book = await createListing(seller, { title: "Engineering Mathematics", isbn: "9788174091956", price: 300 });
    expect(await matches(book)).toEqual([a]);
  });

  it("free items count as under any max price; exchange items have no price", async () => {
    const seller = await createUser();
    const me = await createUser();
    const a = await alert(me, { category: "lab", maxPrice: 100 });
    const free = await createListing(seller, { title: "Lab coat", category: "lab", priceType: "free" });
    const swap = await createListing(seller, { title: "Drafter", category: "lab", priceType: "exchange" });
    expect(await matches(free)).toEqual([a]);
    expect(await matches(swap)).toEqual([]);
  });

  it("never alerts the seller about their own listing", async () => {
    const seller = await createUser();
    await alert(seller, { category: "cycles" });
    const id = await createListing(seller, { category: "cycles", title: "My cycle" });
    expect(await matches(id)).toEqual([]);
  });

  it("skips paused alerts, blocked sellers, hidden and non-active listings", async () => {
    const seller = await createUser();
    const me = await createUser();
    await alert(me, { category: "other", active: false });
    const live = await alert(me, { query: "kettle" });
    const reserved = await createListing(seller, { title: "Kettle", status: "reserved" });
    const hidden = await createListing(seller, { title: "Kettle", hidden: true });
    expect(await matches(reserved)).toEqual([]);
    expect(await matches(hidden)).toEqual([]);
    const ok = await createListing(seller, { title: "Kettle" });
    expect(await matches(ok)).toEqual([live]);
    await sql("INSERT INTO app.blocks (blocker_id, blocked_id) VALUES ($1, $2)", [me.id, seller.id]);
    expect(await matches(ok)).toEqual([]);
  });

  it("each alert fires at most once per listing", async () => {
    const seller = await createUser();
    const me = await createUser();
    const a = await alert(me, { query: "lamp" });
    const id = await createListing(seller, { title: "Study lamp" });
    expect(await matches(id)).toEqual([a]);
    await sql("INSERT INTO app.alert_deliveries (alert_id, listing_id) VALUES ($1, $2)", [a, id]);
    expect(await matches(id)).toEqual([]);
  });

  it("caps each student at 10 alerts", async () => {
    const me = await createUser();
    await sql(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: me.id, role: "authenticated" })]);
    for (let i = 0; i < 10; i++) await alert(me, { query: `thing ${i}` });
    await expect(alert(me, { query: "one too many" })).rejects.toThrow(/RATE_LIMIT:alerts/);
  });
});
