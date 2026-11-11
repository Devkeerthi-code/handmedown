"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createListing, discardUploads, updateListing } from "@/app/actions/listings";
import { Icon } from "@/components/Icon";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";
import { PICKUP_SPOTS } from "@/config/campus";
import { CATEGORIES, CONDITIONS } from "@/lib/catalog";
import { normalizeIsbn } from "@/lib/isbn";
import type { ListingInput } from "@/lib/validation";
import { PhotoPicker, type PhotoItem } from "./PhotoPicker";

export type ListingFormValues = {
  title: string;
  description: string;
  category: string;
  condition: string;
  priceType: "fixed" | "free" | "exchange";
  price: string;
  originalPrice: string;
  exchangeFor: string;
  pickupSpot: string;
  isbn: string;
  bookSemester: string;
  bookSubject: string;
  bookAuthor: string;
};

export const EMPTY_LISTING: ListingFormValues = {
  title: "",
  description: "",
  category: "",
  condition: "",
  priceType: "fixed",
  price: "",
  originalPrice: "",
  exchangeFor: "",
  pickupSpot: "",
  isbn: "",
  bookSemester: "",
  bookSubject: "",
  bookAuthor: "",
};

type Props = {
  userId: string;
  listingId?: string;
  initial?: ListingFormValues;
  initialPhotos?: PhotoItem[];
};

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      <span className="field__error" id={`${id}-error`} role="alert">
        <Icon name="info" />
        {error}
      </span>
    </div>
  );
}

export function ListingForm({ userId, listingId, initial = EMPTY_LISTING, initialPhotos = [] }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const initialPaths = useMemo(() => new Set(initialPhotos.map((p) => p.path)), [initialPhotos]);

  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const uploading = photos.some((p) => p.status === "compressing" || p.status === "uploading");
  const isBook = values.category === "books";
  const isbnHint = values.isbn.trim()
    ? normalizeIsbn(values.isbn)
      ? "Looks right. Buyers can find this book by its ISBN."
      : "Keep typing… an ISBN has 10 or 13 digits."
    : "On the back cover, above the barcode. Lets buyers search by ISBN.";

  const aria = (key: string, withHint = false) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": [withHint ? `${key}-hint` : null, errors[key] ? `${key}-error` : null].filter(Boolean).join(" ") || undefined,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) {
      toast("Photos are still uploading", "Give it a second and try again.", { type: "error" });
      return;
    }
    const payload: ListingInput = {
      ...values,
      category: values.category as ListingInput["category"],
      condition: values.condition as ListingInput["condition"],
      pickupSpot: values.pickupSpot as ListingInput["pickupSpot"],
      photos: photos
        .filter((p) => p.status === "done" && p.path)
        .map((p) => ({ path: p.path!, width: p.width!, height: p.height! })),
    };
    start(async () => {
      const result = listingId ? await updateListing(listingId, payload) : await createListing(payload);
      if (!result.ok) {
        setErrors(result.fields ?? {});
        toast(result.error, undefined, { type: "error" });
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      toast(listingId ? "Changes saved" : "Your listing is live", listingId ? undefined : "Juniors can find it now.");
      router.push(`/l/${result.data.id}`);
      router.refresh();
    });
  };

  const cancel = () => {
    const fresh = photos.filter((p) => p.path && !initialPaths.has(p.path)).map((p) => p.path!);
    if (fresh.length) void discardUploads(fresh);
    router.back();
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form className="sell" onSubmit={submit} noValidate>
      <div
        ref={summaryRef}
        tabIndex={-1}
        className={`error-summary${errorCount ? " is-on" : ""}`}
        role="alert"
      >
        <Icon name="info" />
        <span>
          {errorCount === 1 ? "One thing needs fixing" : `${errorCount} things need fixing`} before this can go live.
        </span>
      </div>

      <div className="panel" style={{ display: "grid", gap: "var(--s4)" }}>
        <PhotoPicker userId={userId} photos={photos} onChange={setPhotos} error={errors.photos} />

        <Field id="title" label="What are you selling?" error={errors.title}>
          <input
            id="title"
            className="input"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={80}
            placeholder="e.g. Casio fx-991ES Plus calculator"
            autoComplete="off"
            {...aria("title")}
          />
        </Field>

        <div className="form-grid form-grid--2">
          <Field id="category" label="Category" error={errors.category}>
            <select id="category" className="select" value={values.category} onChange={(e) => set("category", e.target.value)} {...aria("category")}>
              <option value="" disabled>
                Choose one
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="condition" label="Condition" error={errors.condition}>
            <select id="condition" className="select" value={values.condition} onChange={(e) => set("condition", e.target.value)} {...aria("condition")}>
              <option value="" disabled>
                Choose one
              </option>
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.hint}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isBook ? (
          <div className="book-fields">
            <p className="field__hint" style={{ fontWeight: 600 }}>
              <Icon name="book" className="inline" /> Book details help juniors find the right edition
            </p>
            <div className="form-grid form-grid--2">
              <Field id="isbn" label="ISBN (optional)" hint={isbnHint} error={errors.isbn}>
                <input id="isbn" className="input" inputMode="numeric" value={values.isbn} onChange={(e) => set("isbn", e.target.value)} maxLength={20} placeholder="978…" {...aria("isbn", true)} />
              </Field>
              <Field id="bookSemester" label="For semester (optional)" error={errors.bookSemester}>
                <select id="bookSemester" className="select" value={values.bookSemester} onChange={(e) => set("bookSemester", e.target.value)} {...aria("bookSemester")}>
                  <option value="">Not specific</option>
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      Semester {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="bookSubject" label="Subject (optional)" error={errors.bookSubject}>
                <input id="bookSubject" className="input" value={values.bookSubject} onChange={(e) => set("bookSubject", e.target.value)} maxLength={60} placeholder="e.g. Engineering Mathematics" {...aria("bookSubject")} />
              </Field>
              <Field id="bookAuthor" label="Author (optional)" error={errors.bookAuthor}>
                <input id="bookAuthor" className="input" value={values.bookAuthor} onChange={(e) => set("bookAuthor", e.target.value)} maxLength={80} placeholder="e.g. B.S. Grewal" {...aria("bookAuthor")} />
              </Field>
            </div>
          </div>
        ) : null}

        <div className="field">
          <span className="field__label">Price</span>
          <Segmented
            name="priceType"
            legend="Price type"
            value={values.priceType}
            onChange={(v) => set("priceType", v)}
            options={[
              { value: "fixed", label: "Set a price" },
              { value: "free", label: "Free" },
              { value: "exchange", label: "Exchange" },
            ]}
          />
        </div>

        {values.priceType === "fixed" ? (
          <div className="form-grid form-grid--2">
            <Field id="price" label="Your price" error={errors.price}>
              <div className="prefix-input">
                <span aria-hidden="true">₹</span>
                <input id="price" className="input" inputMode="numeric" value={values.price} onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))} maxLength={6} placeholder="350" {...aria("price")} />
              </div>
            </Field>
            <Field id="originalPrice" label="Price when new (optional)" hint="Shows buyers how much they save." error={errors.originalPrice}>
              <div className="prefix-input">
                <span aria-hidden="true">₹</span>
                <input id="originalPrice" className="input" inputMode="numeric" value={values.originalPrice} onChange={(e) => set("originalPrice", e.target.value.replace(/[^\d]/g, ""))} maxLength={7} placeholder="1150" {...aria("originalPrice", true)} />
              </div>
            </Field>
          </div>
        ) : values.priceType === "exchange" ? (
          <Field id="exchangeFor" label="What would you swap it for? (optional)" error={errors.exchangeFor}>
            <input id="exchangeFor" className="input" value={values.exchangeFor} onChange={(e) => set("exchangeFor", e.target.value)} maxLength={80} placeholder="e.g. Surveying textbook (Punmia)" {...aria("exchangeFor")} />
          </Field>
        ) : (
          <p className="field__hint">Giving it away. Someone will be very happy.</p>
        )}

        <Field id="pickupSpot" label="Where can buyers pick it up?" error={errors.pickupSpot}>
          <select id="pickupSpot" className="select" value={values.pickupSpot} onChange={(e) => set("pickupSpot", e.target.value)} {...aria("pickupSpot")}>
            <option value="" disabled>
              Choose a campus spot
            </option>
            {PICKUP_SPOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field id="description" label="Details (optional)" hint="Mention marks, missing parts, or why you're selling." error={errors.description}>
          <textarea id="description" className="textarea" value={values.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} placeholder="Pencil notes in two chapters, otherwise clean." {...aria("description", true)} />
        </Field>
      </div>

      <div className="form-actions">
        <p>No phone number needed. Buyers message you here and you choose when to meet.</p>
        <div style={{ display: "flex", gap: "var(--s2)" }}>
          <button className="btn btn--ghost" type="button" onClick={cancel} disabled={pending}>
            Cancel
          </button>
          <button className="btn btn--primary btn--lg" type="submit" disabled={pending || uploading} aria-busy={pending}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {listingId ? "Save changes" : uploading ? "Uploading photos…" : "Post listing"}
          </button>
        </div>
      </div>
    </form>
  );
}
