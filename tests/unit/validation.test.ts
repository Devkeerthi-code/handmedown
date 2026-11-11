import { describe, expect, it } from "vitest";
import { alertInputSchema, filtersToQuery, listingInputSchema, parseSearchFilters, reportSchema } from "@/lib/validation";

const base = {
  title: "Casio fx-991ES Plus",
  category: "electronics",
  condition: "like_new",
  priceType: "fixed",
  price: "600",
  pickupSpot: "Central Library",
} as const;

describe("listingInputSchema", () => {
  it("accepts a normal listing and coerces the price", () => {
    const r = listingInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data?.price).toBe(600);
    expect(r.data?.photos).toEqual([]);
  });

  it("requires a price for fixed-price listings", () => {
    const r = listingInputSchema.safeParse({ ...base, price: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["price"]);
  });

  it("drops the price for Free and Exchange", () => {
    expect(listingInputSchema.parse({ ...base, priceType: "free" }).price).toBeNull();
    const ex = listingInputSchema.parse({ ...base, priceType: "exchange", exchangeFor: "A drafter" });
    expect(ex.price).toBeNull();
    expect(ex.exchangeFor).toBe("A drafter");
  });

  it("rejects silly prices and unknown pickup spots", () => {
    expect(listingInputSchema.safeParse({ ...base, price: "-5" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...base, price: "12.5" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...base, price: "9999999" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...base, pickupSpot: "My room" }).success).toBe(false);
  });

  it("keeps book fields only for books and normalises the ISBN", () => {
    const book = listingInputSchema.parse({ ...base, category: "books", isbn: "978-81-7409-195-6", bookSemester: "2" });
    expect(book.isbn).toBe("9788174091956");
    expect(book.bookSemester).toBe(2);
    const notBook = listingInputSchema.parse({ ...base, isbn: "9788174091956", bookSemester: "2" });
    expect(notBook.isbn).toBeNull();
    expect(notBook.bookSemester).toBeNull();
  });

  it("rejects an ISBN with a bad checksum on books", () => {
    const r = listingInputSchema.safeParse({ ...base, category: "books", isbn: "9788174091957" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["isbn"]);
  });

  it("caps photos at five", () => {
    const photo = { path: "a".repeat(20), width: 10, height: 10 };
    expect(listingInputSchema.safeParse({ ...base, photos: Array(6).fill(photo) }).success).toBe(false);
  });
});

describe("parseSearchFilters", () => {
  it("falls back to safe defaults for bad input", () => {
    const f = parseSearchFilters({ category: "weapons", sort: "random", min: "abc", free: "yes" });
    expect(f).toMatchObject({ category: undefined, sort: "newest", min: undefined, free: false });
  });

  it("parses a full query and swaps a reversed price range", () => {
    const f = parseSearchFilters({ q: "  cycle ", category: "cycles", min: "2000", max: "500", free: "1", sort: "price_asc" });
    expect(f).toMatchObject({ q: "cycle", category: "cycles", min: 500, max: 2000, free: true, sort: "price_asc" });
  });

  it("round-trips through the URL", () => {
    const f = parseSearchFilters({ q: "grewal", category: "books", max: "500", sort: "price_desc" });
    expect(parseSearchFilters(Object.fromEntries(filtersToQuery(f)))).toEqual(f);
  });
});

describe("alertInputSchema", () => {
  it("needs at least one criterion", () => {
    expect(alertInputSchema.safeParse({ freeOnly: false }).success).toBe(false);
    expect(alertInputSchema.safeParse({ query: "cycle" }).success).toBe(true);
  });

  it("stores an ISBN query as ISBN-13", () => {
    expect(alertInputSchema.parse({ query: "0-306-40615-2" }).query).toBe("9780306406157");
  });
});

it("reportSchema needs a target and a known reason", () => {
  expect(reportSchema.safeParse({ reason: "scam" }).success).toBe(false);
  expect(reportSchema.safeParse({ listingId: "11111111-1111-4111-8111-111111111111", reason: "nope" }).success).toBe(false);
  expect(reportSchema.safeParse({ listingId: "11111111-1111-4111-8111-111111111111", reason: "scam" }).success).toBe(true);
});
