import { describe, expect, it } from "vitest";
import { parseAlertPhrase } from "@/lib/alert-phrase";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { friendlyError } from "@/lib/errors";
import { formatInr, initials, timeAgo } from "@/lib/format";
import { containsPhoneNumber } from "@/lib/phone";
import { rubberBand } from "@/lib/physics";

describe("parseAlertPhrase (home page alert box)", () => {
  it("reads 'cycle under 2000'", () => {
    expect(parseAlertPhrase("cycle under 2000")).toMatchObject({ query: "cycle", category: "cycles", maxPrice: 2000 });
  });
  it("understands ₹, commas and k", () => {
    expect(parseAlertPhrase("mattress below ₹1,500").maxPrice).toBe(1500);
    expect(parseAlertPhrase("laptop under 20k")).toMatchObject({ maxPrice: 20000, category: "electronics" });
  });
  it("spots free-only requests", () => {
    expect(parseAlertPhrase("free lab coat")).toMatchObject({ freeOnly: true, category: "lab", query: "lab coat" });
  });
});

describe("cursor", () => {
  it("round-trips and rejects tampering", () => {
    const c = { v: "2026-11-11 10:00:00.123456+00", id: "11111111-1111-4111-8111-111111111111" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ v: 1, id: "x" })).toString("base64url"))).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});

describe("containsPhoneNumber", () => {
  it("catches Indian mobile numbers in common formats", () => {
    for (const t of ["call 9876543210", "+91 98765 43210", "my no is 98765-43210", "+919876543210"]) {
      expect(containsPhoneNumber(t)).toBe(true);
    }
  });
  it("ignores prices, ISBNs and short numbers", () => {
    for (const t of ["₹1500 final", "ISBN 9788174091956", "room 204, block C", "1234567890"]) {
      expect(containsPhoneNumber(t)).toBe(false);
    }
  });
});

describe("format", () => {
  it("formats rupees the Indian way", () => {
    expect(formatInr(125000)).toBe("₹1,25,000");
  });
  it("says how long ago", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    expect(timeAgo("2026-11-11T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-11-11T11:25:00Z", now)).toBe("35 min ago");
    expect(timeAgo("2026-11-11T10:00:00Z", now)).toBe("2h ago");
    expect(timeAgo("2026-11-08T12:00:00Z", now)).toBe("3d ago");
  });
  it("makes initials", () => {
    expect(initials("Ananya Rao")).toBe("AR");
    expect(initials("karthik")).toBe("K");
  });
});

describe("friendlyError", () => {
  it("maps database errors to plain language", () => {
    expect(friendlyError(new Error("RATE_LIMIT:messages"))).toMatch(/very fast/);
    expect(friendlyError(new Error('new row violates row-level security policy for table "listings"'))).toBe(
      "You're not allowed to do that.",
    );
    expect(friendlyError(new Error("boom", { cause: new Error("permission denied for table usage_events") }))).toBe(
      "You're not allowed to do that.",
    );
    expect(friendlyError(new Error("something odd"))).toMatch(/Something went wrong/);
  });
});

it("rubber band resists more the further you pull", () => {
  const a = rubberBand(50, 300);
  const b = rubberBand(200, 300);
  expect(a).toBeLessThan(50);
  expect(b).toBeLessThan(200);
  expect(b - a).toBeLessThan(150);
  expect(rubberBand(-50, 300)).toBe(-a);
});
