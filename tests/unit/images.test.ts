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
const COLLEGE = "44444444-4444-4444-8444-444444444444";
const OTHER_COLLEGE = "55555555-5555-4555-8555-555555555555";

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
  const good = { path: photoPath(COLLEGE, USER, PHOTO, "image/webp"), mimetype: "image/webp", size: 200_000 };

  it("accepts a small WebP or JPEG in the owner's folder", () => {
    expect(validateStoredPhoto(good, USER, COLLEGE).ok).toBe(true);
    expect(validateStoredPhoto({ ...good, path: photoPath(COLLEGE, USER, PHOTO, "image/jpeg"), mimetype: "image/jpeg" }, USER, COLLEGE).ok).toBe(true);
  });

  it("rejects someone else's photo", () => {
    expect(validateStoredPhoto(good, OTHER, COLLEGE)).toEqual({ ok: false, reason: "That photo belongs to someone else." });
  });

  it("rejects a photo uploaded under another college's folder", () => {
    expect(validateStoredPhoto(good, USER, OTHER_COLLEGE)).toEqual({ ok: false, reason: "That photo was uploaded for another college." });
  });

  it("rejects wrong types and sizes", () => {
    expect(validateStoredPhoto({ ...good, mimetype: "image/png" }, USER, COLLEGE).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, mimetype: null }, USER, COLLEGE).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, size: MAX_UPLOAD_BYTES + 1 }, USER, COLLEGE).ok).toBe(false);
    expect(validateStoredPhoto({ ...good, size: 0 }, USER, COLLEGE).ok).toBe(false);
  });

  it("rejects paths that try to escape the folder or use odd names", () => {
    for (const path of [`${COLLEGE}/${USER}/../${OTHER}/${PHOTO}.webp`, `${COLLEGE}/${USER}/${PHOTO}.png`, `${COLLEGE}/${USER}/${PHOTO}_t.webp`, `${USER}/${PHOTO}.webp`]) {
      expect(validateStoredPhoto({ ...good, path }, USER, COLLEGE).ok).toBe(false);
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
