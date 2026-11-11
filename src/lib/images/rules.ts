/** Photo rules shared by the browser (before upload) and the server (before linking to a listing). */

export const MAX_PHOTOS = 5;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 1024 * 1024; // matches the bucket's file_size_limit
export const FULL_EDGE = 1600;
export const THUMB_EDGE = 480;

export const SOURCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
] as const;

export const UPLOAD_TYPES = ["image/webp", "image/jpeg"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export type Check = { ok: true } | { ok: false; reason: string };

/** First gate: what the user picked from their gallery, before we compress it. */
export function validateSourceFile(file: { type: string; size: number }): Check {
  if (!(SOURCE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Only photos work here: JPG, PNG, WebP or HEIC." };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, reason: "That photo is over 20 MB. Pick a smaller one." };
  return { ok: true };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(webp|jpg)$`);

/** Photos live under <college>/<user>/ so storage policies can enforce membership of that college. */
export function photoPath(collegeId: string, userId: string, photoId: string, type: UploadType) {
  return `${collegeId}/${userId}/${photoId}.${type === "image/webp" ? "webp" : "jpg"}`;
}

/** The small grid version sits next to the full one: abc.webp -> abc_t.webp */
export function thumbPathOf(path: string) {
  return path.replace(/\.(webp|jpg)$/, "_t.$1");
}

/** Second gate: what actually landed in Storage, read back on the server. */
export function validateStoredPhoto(
  object: { path: string; mimetype: string | null; size: number | null },
  userId: string,
  collegeId: string,
): Check {
  const match = PHOTO_PATH.exec(object.path);
  if (!match) return { ok: false, reason: "Photo path is not in the expected format." };
  if (match[1] !== collegeId) return { ok: false, reason: "That photo was uploaded for another college." };
  if (match[2] !== userId) return { ok: false, reason: "That photo belongs to someone else." };
  if (!object.mimetype || !(UPLOAD_TYPES as readonly string[]).includes(object.mimetype)) {
    return { ok: false, reason: "Photo must be WebP or JPEG after compression." };
  }
  if (object.size == null || object.size <= 0 || object.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Photo is larger than 1 MB after compression." };
  }
  return { ok: true };
}

/** Fit inside a square box of `edge`, never upscale. */
export function fitWithin(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
