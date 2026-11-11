import { describe, expect, it } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/cursor";
import { buildCountQuery, buildSearchQuery } from "@/lib/listings/search-sql";
import { parseSearchFilters } from "@/lib/validation";
import { beforeEach } from "vitest";
import { COLLEGE_A, as, createListing, createUser, isolateCatalogue, sql, withTestDatabase } from "./helpers";

withTestDatabase();
beforeEach(isolateCatalogue);

type Row = { id: string; title: string; sort_value: string };

async function search(params: Record<string, string>, viewerId: string | null = null, cursor: string | null = null, limit = 12) {
  const q = buildSearchQuery(parseSearchFilters(params), decodeCursor(cursor), viewerId, COLLEGE_A, limit);
  return sql<Row>(q.text, q.values as unknown[]);
}

async function seedCatalogue() {
  const seller = await createUser();
  const ids = {
    calc: await createListing(seller, { title: "Casio fx-991ES calculator", category: "electronics", price: 600 }),
    cycle: await createListing(seller, { title: "Hercules cycle 26 inch", category: "cycles", price: 1800 }),
    cheapCycle: await createListing(seller, { title: "Old cycle, needs brakes", category: "cycles", price: 400 }),
    coat: await createListing(seller, { title: "Lab coat size M", category: "lab", priceType: "free" }),
    drafter: await createListing(seller, { title: "Mini drafter", category: "lab", priceType: "exchange" }),
    book: await createListing(seller, { title: "Engineering Mathematics", category: "books", price: 350, isbn: "9788174091956", description: "Grewal, pencil notes" }),
    sold: await createListing(seller, { title: "Sold cycle", category: "cycles", price: 900, status: "sold" }),
    hidden: await createListing(seller, { title: "Hidden cycle", category: "cycles", price: 700, hidden: true }),
  };
  return { seller, ids };
}

const idsOf = (rows: Row[]) => rows.map((r) => r.id);

describe("search and filters", () => {
  it("finds listings by words, with prefix matching while typing", async () => {
    const { ids } = await seedCatalogue();
    await as(null);
    expect(idsOf(await search({ q: "calc" }))).toEqual([ids.calc]);
    expect(idsOf(await search({ q: "cycles" })).sort()).toEqual([ids.cycle, ids.cheapCycle].sort());
    expect(idsOf(await search({ q: "grewal" }))).toEqual([ids.book]); // description is searchable too
  });

  it("finds a book by ISBN-13 or ISBN-10, hyphens or not", async () => {
    const { ids } = await seedCatalogue();
    await as(null);
    expect(idsOf(await search({ q: "978-81-7409-195-6" }))).toEqual([ids.book]);
  });

  it("never returns sold or hidden listings", async () => {
    const { ids } = await seedCatalogue();
    await as(null);
    const all = idsOf(await search({}, null, null, 50));
    expect(all).not.toContain(ids.sold);
    expect(all).not.toContain(ids.hidden);
  });

  it("filters by category, price range, free-only and exchange", async () => {
    const { ids } = await seedCatalogue();
    await as(null);
    expect(idsOf(await search({ category: "cycles" })).sort()).toEqual([ids.cycle, ids.cheapCycle].sort());
    expect(idsOf(await search({ category: "cycles", max: "500" }))).toEqual([ids.cheapCycle]);
    expect(idsOf(await search({ min: "500", max: "1000" }))).toEqual([ids.calc]);
    expect(idsOf(await search({ free: "1" }))).toEqual([ids.coat]);
    expect(idsOf(await search({ exchange: "1" }))).toEqual([ids.drafter]);
    // "Under ₹500" includes free things, excludes exchange (no price).
    const cheap = idsOf(await search({ max: "499" }));
    expect(cheap.sort()).toEqual([ids.cheapCycle, ids.coat, ids.book].sort());
  });

  it("sorts by price both ways, free as ₹0 and exchange last", async () => {
    const { ids } = await seedCatalogue();
    await as(null);
    const asc = idsOf(await search({ sort: "price_asc" }, null, null, 50));
    expect(asc[0]).toBe(ids.coat);
    expect(asc[asc.length - 1]).toBe(ids.drafter);
    const desc = idsOf(await search({ sort: "price_desc" }, null, null, 50));
    expect(desc[0]).toBe(ids.cycle);
    expect(desc[desc.length - 1]).toBe(ids.drafter);
  });

  it("count matches the filtered results", async () => {
    await seedCatalogue();
    await as(null);
    const q = buildCountQuery(parseSearchFilters({ category: "cycles" }), null, COLLEGE_A);
    const [row] = await sql<{ n: number }>(q.text, q.values as unknown[]);
    expect(row.n).toBe(2);
  });

  it("hides sellers you've blocked", async () => {
    const { seller, ids } = await seedCatalogue();
    const me = await createUser();
    await sql("INSERT INTO app.blocks (blocker_id, blocked_id) VALUES ($1, $2)", [me.id, seller.id]);
    await as(me);
    expect(idsOf(await search({ q: "calc" }, me.id))).not.toContain(ids.calc);
  });
});

describe("cursor pagination", () => {
  it("walks every listing exactly once, even when many share the same timestamp", async () => {
    const seller = await createUser();
    const sameMoment = "2026-11-01T10:00:00.123456Z";
    const created: string[] = [];
    for (let i = 0; i < 7; i++) created.push(await createListing(seller, { title: `Same time ${i}`, createdAt: sameMoment }));
    for (let i = 0; i < 4; i++) created.push(await createListing(seller, { title: `Later ${i}`, createdAt: `2026-11-0${i + 2}T10:00:00Z` }));
    await as(null);

    for (const sort of ["newest", "price_asc", "price_desc"]) {
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const rows = await search({ sort }, null, cursor, 3);
        const pageRows = rows.slice(0, 3);
        seen.push(...idsOf(pageRows));
        if (rows.length <= 3) break;
        const last = pageRows[pageRows.length - 1];
        cursor = encodeCursor({ v: last.sort_value, id: last.id });
      }
      const mine = seen.filter((id) => created.includes(id));
      expect(new Set(mine).size).toBe(mine.length); // no duplicates
      expect(mine.sort()).toEqual([...created].sort()); // nothing skipped
    }
  });

  it("a listing posted while you scroll doesn't shift the pages you're on", async () => {
    const seller = await createUser();
    for (let i = 0; i < 5; i++) await createListing(seller, { title: `Item ${i}`, createdAt: `2026-10-0${i + 1}T10:00:00Z` });
    await as(null);
    const first = await search({ category: "other" }, null, null, 2);
    const last = first[1];
    const cursor = encodeCursor({ v: last.sort_value, id: last.id });
    await sql("RESET ROLE");
    await createListing(seller, { title: "Brand new" });
    await as(null);
    const second = await search({ category: "other" }, null, cursor, 2);
    expect(idsOf(second)).not.toContain(first[0].id);
    expect(second.map((r) => r.title)).not.toContain("Brand new");
  });
});
