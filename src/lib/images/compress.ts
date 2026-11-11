import { fitWithin, FULL_EDGE, MAX_UPLOAD_BYTES, THUMB_EDGE, type UploadType } from "./rules";

export type Compressed = {
  full: Blob;
  thumb: Blob;
  type: UploadType;
  width: number;
  height: number;
};

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Respects EXIF orientation so phone photos aren't sideways.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser can't open that photo. Try a JPG or PNG.");
  }
}

function draw(bitmap: ImageBitmap, edge: number) {
  const size = fitWithin(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the photo on this device.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return { canvas, ...size };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't compress the photo."))), type, quality),
  );
}

/** WebP where the browser can encode it (Safari can't, so it falls back to JPEG). Steps quality down until it fits. */
async function encode(canvas: HTMLCanvasElement, maxBytes: number): Promise<{ blob: Blob; type: UploadType }> {
  for (const quality of [0.82, 0.72, 0.6, 0.5]) {
    let blob = await toBlob(canvas, "image/webp", quality);
    let type: UploadType = "image/webp";
    if (blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", quality);
      type = "image/jpeg";
    }
    if (blob.size <= maxBytes) return { blob, type };
  }
  throw new Error("That photo is too detailed to shrink under 1 MB. Try another one.");
}

/** Resizes to 1600 px (and a 480 px grid thumbnail) on the phone before anything is uploaded. */
export async function compressPhoto(file: File): Promise<Compressed> {
  const bitmap = await decode(file);
  try {
    const full = draw(bitmap, FULL_EDGE);
    const fullEnc = await encode(full.canvas, MAX_UPLOAD_BYTES);
    const thumb = draw(bitmap, THUMB_EDGE);
    const thumbBlob = await toBlob(thumb.canvas, fullEnc.type, 0.72);
    return { full: fullEnc.blob, thumb: thumbBlob, type: fullEnc.type, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}
