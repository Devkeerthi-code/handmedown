"use client";

import Image from "next/image";
import { useId } from "react";
import { Icon } from "@/components/Icon";
import { formatBytes } from "@/lib/format";
import { compressPhoto } from "@/lib/images/compress";
import { MAX_PHOTOS, photoPath, thumbPathOf, validateSourceFile } from "@/lib/images/rules";
import { photoUrl } from "@/lib/photos";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type PhotoItem = {
  key: string;
  path?: string;
  width?: number;
  height?: number;
  preview?: string;
  status: "compressing" | "uploading" | "done" | "error";
  before?: number;
  after?: number;
  error?: string;
};

type Props = {
  userId: string;
  collegeId: string;
  photos: PhotoItem[];
  onChange: (update: (prev: PhotoItem[]) => PhotoItem[]) => void;
  error?: string;
};

/** Pick up to 5 photos. Each is compressed on the phone, then uploaded straight to Storage under your folder. */
export function PhotoPicker({ userId, collegeId, photos, onChange, error }: Props) {
  const inputId = useId();
  const patch = (key: string, next: Partial<PhotoItem>) =>
    onChange((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));

  const process = async (file: File, key: string) => {
    const check = validateSourceFile(file);
    if (!check.ok) {
      patch(key, { status: "error", error: check.reason });
      return;
    }
    try {
      const out = await compressPhoto(file);
      patch(key, { status: "uploading", after: out.full.size, preview: URL.createObjectURL(out.thumb) });
      const path = photoPath(collegeId, userId, crypto.randomUUID(), out.type);
      const bucket = supabaseBrowser().storage.from("listing-photos");
      const opts = { contentType: out.type, cacheControl: "31536000", upsert: false };
      const [full, thumb] = await Promise.all([
        bucket.upload(path, out.full, opts),
        bucket.upload(thumbPathOf(path), out.thumb, opts),
      ]);
      if (full.error || thumb.error) throw new Error("Upload failed. Check your connection and try again.");
      patch(key, { status: "done", path, width: out.width, height: out.height });
    } catch (e) {
      patch(key, { status: "error", error: e instanceof Error ? e.message : "Couldn't add that photo." });
    }
  };

  const add = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const items: PhotoItem[] = picked.map((f) => ({ key: crypto.randomUUID(), status: "compressing", before: f.size }));
    onChange((list) => [...list, ...items]);
    picked.forEach((f, i) => process(f, items[i].key));
  };

  const remove = (key: string) =>
    onChange((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone?.preview?.startsWith("blob:")) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.key !== key);
    });

  return (
    <div className="field" data-invalid={error ? "" : undefined}>
      <span className="field__label" id={`${inputId}-label`}>
        Photos <span className="field__hint">(up to {MAX_PHOTOS}, the first one is the cover)</span>
      </span>
      <div className="photos" role="list" aria-labelledby={`${inputId}-label`}>
        {photos.map((p, i) => (
          <div key={p.key} role="listitem" className={`photo${i === 0 && p.status === "done" ? " photo--cover" : ""}`}>
            {p.preview || p.path ? (
              <Image src={p.preview ?? photoUrl(p.path!, "thumb")} alt={`Photo ${i + 1}`} fill sizes="160px" unoptimized />
            ) : null}
            {p.status !== "done" ? (
              <div className="photo__bar" aria-live="polite">
                {p.status === "error" ? (
                  <span style={{ color: "var(--danger)" }}>{p.error}</span>
                ) : (
                  <>
                    <span>
                      {p.status === "compressing"
                        ? `Shrinking ${formatBytes(p.before ?? 0)}…`
                        : `${formatBytes(p.before ?? 0)} → ${formatBytes(p.after ?? 0)}`}
                    </span>
                    <span className="photo__track">
                      <span className="photo__fill" style={{ width: p.status === "compressing" ? "35%" : "80%" }} />
                    </span>
                  </>
                )}
              </div>
            ) : p.before && p.after ? (
              <div className="photo__bar">
                <span>
                  {formatBytes(p.before)} → {formatBytes(p.after)}
                </span>
              </div>
            ) : null}
            <button className="photo__x" type="button" onClick={() => remove(p.key)} aria-label={`Remove photo ${i + 1}`}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <label className="photo-add" htmlFor={inputId}>
            <Icon name="camera" />
            <b>Add photos</b>
            <span>{MAX_PHOTOS - photos.length} left</span>
            <input
              id={inputId}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
              multiple
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="field__error" role="alert">
        <Icon name="info" />
        {error}
      </p>
    </div>
  );
}
