import { describe, expect, it } from "vitest";
import {
  fitWithin,
  MAX_SOURCE_BYTES,
  MAX_UPLOAD_BYTES,
  photoPath,
  thumbPathOf,
  validateSourceFile,
  validateStoredPhoto,
} from "@/lib/images/rules";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PHOTO = "33333333-3333-4333-8333-333333333333";

describe("validateSourceFile (before compression)", () => {
  it("accepts common phone photo formats", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(validateSourceFile({ type, size: 3_000_000 }).ok).toBe(true);
    }
  });

  it("rejects non-images", () => {
    for (const type of ["application/pdf", "image/svg+xml", "image/gif", "text/html", ""]) {
      expect(validateSourceFile({ type, size: 1000 })).toMatchObject({ ok: false });
    }
  });

  it("rejects empty and oversized files", () => {
    expect(validateSourceFile({ type: "image/jpeg", size: 0 }).ok).toBe(false);
    expect(validateSourceFile({ type: "image/jpeg", size: MAX_SOURCE_BYTES + 1 }).ok).toBe(false);
    expect(validateSourceFile({ type: "image/jpeg", size: MAX_SOURCE_BYTES }).ok).toBe(true);
  });
});

describe("validateStoredPhoto (what actually reached Storage)", () => {
  const good = { path: photoPath(USER, PHOTO, "image/webp"), mimetype: "image/webp", size: 200_000 };

  it("accepts a small WebP or JPEG in the owner's folder", () => {
    expect(validateStoredPhoto(good, USER).ok).toBe(true);
    expect(validateStoredPhoto({ ...good, path: photoPath(USER, PHOTO, "image/jpeg"), mimetype: "image/jpeg" }, USER).ok).toBe(true);
  });

  it("rejects someone else's photo", () => {
    expect(validateStoredPhoto(good, OTHER)).toEqual({ ok: false, reason: "That photo belongs to someone else." });
  });

  it("rejects wrong types and sizes", () => {
    expect(validateStoredPhoto({ ...good, mimetype: "image/png" }, USER).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, mimetype: null }, USER).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, size: MAX_UPLOAD_BYTES + 1 }, USER).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, size: 0 }, USER).ok).toBe(false);
  });

  it("rejects paths that try to escape the folder or use odd names", () => {
    for (const path of [`${USER}/../${OTHER}/${PHOTO}.webp`, `${USER}/${PHOTO}.png`, `${USER}/${PHOTO}_t.webp`, `${PHOTO}.webp`]) {
      expect(validateStoredPhoto({ ...good, path }, USER).ok).toBe(false);
    }
  });
});

describe("sizes and paths", () => {
  it("fits inside the box without upscaling", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 480)).toEqual({ width: 360, height: 480 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("puts the thumbnail next to the full photo", () => {
    expect(thumbPathOf(`${USER}/${PHOTO}.webp`)).toBe(`${USER}/${PHOTO}_t.webp`);
    expect(thumbPathOf(`${USER}/${PHOTO}.jpg`)).toBe(`${USER}/${PHOTO}_t.jpg`);
  });
});
