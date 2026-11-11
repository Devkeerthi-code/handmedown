import { describe, expect, it } from "vitest";
import { formatIsbn, looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";

describe("normalizeIsbn", () => {
  it("accepts a valid ISBN-13 with or without hyphens", () => {
    expect(normalizeIsbn("9788174091956")).toBe("9788174091956");
    expect(normalizeIsbn("978-81-7409-195-6")).toBe("9788174091956");
    expect(normalizeIsbn(" 978 0 19 809930 7 ")).toBe("9780198099307");
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(normalizeIsbn("0-306-40615-2")).toBe("9780306406157");
    expect(normalizeIsbn("817409195X")).toBeNull(); // wrong check digit
    expect(normalizeIsbn("097522980X")).toBe("9780975229804");
  });

  it("rejects bad checksums and junk", () => {
    expect(normalizeIsbn("9788174091957")).toBeNull();
    expect(normalizeIsbn("12345")).toBeNull();
    expect(normalizeIsbn("calculator")).toBeNull();
    expect(normalizeIsbn("1234567890123")).toBeNull(); // not 978/979
  });
});

describe("looksLikeIsbn", () => {
  it("tells ISBN searches apart from word searches", () => {
    expect(looksLikeIsbn("978-81-7409-195-6")).toBe(true);
    expect(looksLikeIsbn("Grewal maths")).toBe(false);
    expect(looksLikeIsbn("2000")).toBe(false);
  });
});

it("formats an ISBN-13 for display", () => {
  expect(formatIsbn("9788174091956")).toBe("978-81-7409-195-6");
});
