import { describe, expect, it } from "vitest";
import { buildCountQuery, buildSearchQuery, PAGE_SIZE } from "@/lib/listings/search-sql";
import { parseSearchFilters } from "@/lib/validation";

const sqlOf = (params: Record<string, string>, cursor: { v: string; id: string } | null = null, viewer: string | null = null) => {
  const q = buildSearchQuery(parseSearchFilters(params), cursor, viewer);
  return { text: q.text.replace(/\s+/g, " "), values: q.values };
};

describe("buildSearchQuery", () => {
  it("always hides hidden and sold listings and fetches one extra row", () => {
    const { text, values } = sqlOf({});
    expect(text).toContain("NOT l.is_hidden");
    expect(text).toContain("l.status <> 'sold'");
    expect(values).toContain(PAGE_SIZE + 1);
  });

  it("uses full-text search for words and exact match for ISBNs", () => {
    const words = sqlOf({ q: "casio calc" });
    expect(words.text).toContain("app.prefix_tsquery(");
    expect(words.values).toContain("casio calc");

    const isbn = sqlOf({ q: "978-81-7409-195-6" });
    expect(isbn.text).toContain("l.isbn = $");
    expect(isbn.values).toContain("9788174091956");
  });

  it("passes every user value as a parameter, never inline", () => {
    const { text } = sqlOf({ q: "'; DROP TABLE app.listings; --", category: "books", min: "100", max: "900" });
    expect(text).not.toContain("DROP TABLE");
    expect(text).not.toContain("'books'");
  });

  it("filters free, exchange and price ranges", () => {
    expect(sqlOf({ free: "1" }).text).toContain("l.price_type = 'free'");
    expect(sqlOf({ exchange: "1" }).text).toContain("l.price_type = 'exchange'");
    expect(sqlOf({ free: "1", exchange: "1" }).text).toContain("l.price_type IN ('free', 'exchange')");
    const ranged = sqlOf({ min: "500", max: "2000" });
    expect(ranged.text).toContain("l.price >= $");
    expect(ranged.text).toContain("l.price <= $");
    expect(ranged.values).toEqual(expect.arrayContaining([500, 2000]));
  });

  it("orders newest first with an id tie-breaker and a matching keyset cursor", () => {
    const { text } = sqlOf({}, { v: "2026-11-11 10:00:00.123456+00", id: "11111111-1111-4111-8111-111111111111" });
    expect(text).toContain("ORDER BY l.created_at DESC, l.id DESC");
    expect(text).toMatch(/\(l\.created_at, l\.id\) < \(\$\d+::timestamptz, \$\d+::uuid\)/);
  });

  it("walks forward for price low-to-high and backward for high-to-low", () => {
    const cur = { v: "500", id: "11111111-1111-4111-8111-111111111111" };
    expect(sqlOf({ sort: "price_asc" }, cur).text).toMatch(/END\), l\.id\) > \(/);
    expect(sqlOf({ sort: "price_desc" }, cur).text).toMatch(/END\), l\.id\) < \(/);
  });

  it("hides sellers the viewer blocked, only when signed in", () => {
    expect(sqlOf({}).text).not.toContain("app.blocks");
    expect(sqlOf({}, null, "11111111-1111-4111-8111-111111111111").text).toContain("app.blocks");
  });
});

it("count query shares the same WHERE", () => {
  const f = parseSearchFilters({ category: "cycles", free: "1" });
  const count = buildCountQuery(f, null).text;
  expect(count).toContain("count(*)");
  expect(count).toContain("l.category = $");
  expect(count).toContain("l.price_type = 'free'");
});
