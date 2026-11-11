"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { createCollege, uploadCollegeLogo } from "@/app/actions/colleges";
import { Icon, type IconName } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { PRESETS, Spring } from "@/lib/physics";
import { ACCENT_SWATCHES, PLATFORM_ACCENT, normalizeAccent, parseHex } from "@/lib/theme";
import type { CreateCollegeInput } from "@/lib/validation";
import { ThemePreview } from "./ThemePreview";

export type OnboardingState =
  | { kind: "signed-out" }
  | { kind: "unverified"; email: string }
  | { kind: "public-domain"; email: string; domain: string }
  | { kind: "exists"; domain: string; college: { slug: string; name: string } }
  | { kind: "ready"; email: string; domain: string };

type Category = { id: string; label: string };

export const PICKUP_SUGGESTIONS = ["Main gate", "Central library", "Canteen", "Admin block", "Hostel lobby"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STOP_WORDS = new Set(["of", "and", "the", "for", "in", "at", "&"]);
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_INPUT = 8 * 1024 * 1024;
const LOGO_MAX_OUTPUT = 1024 * 1024;
const LOGO_PX = 256;

/* ---------- Pure helpers ---------- */

/** "National Institute of Technology Calicut" -> "NITC"; one-word names keep the word. */
export function suggestShortName(name: string) {
  const words = name.trim().split(/[\s,.-]+/).filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  const initials = words.map((w) => w[0]).join("").toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 12);
  return (words[0] ?? "").slice(0, 12);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Keeps what the user is typing (a trailing hyphen is allowed mid-edit); validation catches the rest. */
const cleanSlugInput = (text: string) => text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);

type Values = { name: string; shortName: string; slug: string; accent: string; pickupSpots: string[]; categories: string[] };

export function validateCollege(v: Values): Record<string, string> {
  const e: Record<string, string> = {};
  const name = v.name.trim();
  const short = v.shortName.trim();
  if (name.length < 3) e.name = "Enter your college's full name.";
  else if (name.length > 80) e.name = "Keep it under 80 characters.";
  if (short.length < 2 || short.length > 12) e.shortName = "Use 2 to 12 characters, like NITC or SJCE.";
  if (v.slug.length < 2 || !SLUG_RE.test(v.slug)) e.slug = "Use lowercase letters, numbers and single hyphens (at least 2 characters).";
  if (!parseHex(v.accent)) e.accent = "Pick a colour.";
  if (!v.pickupSpots.length) e.pickupSpots = "Add at least one place where students can meet.";
  if (!v.categories.length) e.categories = "Keep at least one category.";
  return e;
}

/** Downscales into a 256x256 transparent square (contain-fit), WebP where the browser can encode it. */
export async function downscaleLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_PX;
  canvas.height = LOGO_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const scale = Math.min(LOGO_PX / bitmap.width, LOGO_PX / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (LOGO_PX - w) / 2, (LOGO_PX - h) / 2, w, h);
  bitmap.close();
  const encode = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await encode("image/webp", 0.9);
  // Safari can't encode WebP and silently returns PNG; either is accepted.
  if (!blob || !LOGO_TYPES.includes(blob.type)) blob = await encode("image/png");
  if (!blob) throw new Error("Could not encode the logo");
  if (blob.size > LOGO_MAX_OUTPUT) blob = (await encode("image/jpeg", 0.85)) ?? blob;
  if (blob.size > LOGO_MAX_OUTPUT) throw new Error("Logo is still over 1 MB after resizing");
  return blob;
}

/* ---------- Small building blocks ---------- */

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
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

const describedBy = (id: string, error?: string, hint = true) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

/** Eight curated swatches plus a free colour picker and hex field. The chosen swatch pops on a spring. */
export function AccentPicker({ value, onChange, error }: { value: string; onChange: (hex: string) => void; error?: string }) {
  const id = useId();
  const [hexDraft, setHexDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const groupRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);

  if (value !== lastValue) {
    setLastValue(value);
    setHexDraft(value);
  }

  useEffect(() => () => springRef.current?.stop(), []);

  const pick = (hex: string) => {
    onChange(hex);
    const el = groupRef.current?.querySelector<HTMLElement>(`[data-hex="${hex}"] .swatch__dot`);
    if (!el) return;
    springRef.current?.stop();
    springRef.current = new Spring(0.78, PRESETS.chip, (v) => {
      el.style.transform = v === 1 ? "" : `scale(${v.toFixed(4)})`;
    });
    springRef.current.set(1, 3);
  };

  const upper = value.toUpperCase();
  const isCustom = !ACCENT_SWATCHES.some((s) => s.hex === upper);

  return (
    <fieldset className="field accent-pick" data-invalid={error ? "" : undefined}>
      <legend className="field__label">Accent colour</legend>
      <div ref={groupRef} className="swatches" role="radiogroup" aria-label="Suggested colours">
        {ACCENT_SWATCHES.map((s) => (
          <label key={s.hex} className="swatch" data-hex={s.hex} title={s.name}>
            <input type="radio" name={`${id}-swatch`} value={s.hex} checked={upper === s.hex} onChange={() => pick(s.hex)} />
            <span className="swatch__dot" style={{ background: s.hex }} />
            <span className="sr-only">{s.name}</span>
          </label>
        ))}
      </div>
      <div className="accent-pick__custom">
        <label className={`swatch swatch--custom${isCustom ? " is-on" : ""}`}>
          <input type="color" value={value.toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())} />
          <span className="swatch__dot" style={{ background: value }} aria-hidden="true" />
          <span className="sr-only">Custom colour</span>
        </label>
        <label htmlFor={`${id}-hex`} className="sr-only">
          Colour as hex
        </label>
        <input
          id={`${id}-hex`}
          className="input accent-pick__hex"
          value={hexDraft}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            const next = e.target.value.trim();
            setHexDraft(next);
            if (/^#?[0-9a-f]{6}$/i.test(next)) onChange(normalizeAccent(next));
          }}
          onBlur={() => setHexDraft(value)}
        />
      </div>
      <span className="field__hint" id={`${id}-hint`}>
        Your college colour, or paste its hex code. We keep it readable automatically.
      </span>
      <span className="field__error" role="alert">
        <Icon name="info" />
        {error}
      </span>
    </fieldset>
  );
}

/** Type + Enter to add, × to remove. Used for pickup spots here and in college settings. */
export function ChipListEditor({
  id,
  label,
  items,
  onChange,
  max = 30,
  maxLength = 40,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const text = draft.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (items.length >= max) return setNote(`That's the limit of ${max}. Remove one to add another.`);
    if (items.some((i) => i.toLowerCase() === text.toLowerCase())) return setNote(`“${text}” is already on the list.`);
    onChange([...items, text]);
    setDraft("");
    setNote(`Added ${text}.`);
  };

  const remove = (item: string) => {
    onChange(items.filter((i) => i !== item));
    setNote(`Removed ${item}.`);
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="field chip-editor" data-invalid={error ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      {items.length ? (
        <ul className="chip-editor__list" aria-label={label}>
          {items.map((item) => (
            <li key={item} className="chip-editor__chip">
              <span>{item}</span>
              <button type="button" onClick={() => remove(item)} aria-label={`Remove ${item}`}>
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="chip-editor__add">
        <input
          ref={inputRef}
          id={id}
          className="input"
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          aria-describedby={describedBy(id, error)}
          aria-invalid={error ? true : undefined}
        />
        <button type="button" className="btn btn--outline btn--sm" onClick={add} disabled={!draft.trim() || items.length >= max}>
          <Icon name="plus" />
          Add
        </button>
      </div>
      <span className="field__hint" id={`${id}-hint`}>
        {hint ? `${hint} ` : ""}
        {items.length} of {max}.
      </span>
      <span className="sr-only" aria-live="polite">
        {note}
      </span>
      <span className="field__error" id={`${id}-error`} role="alert">
        <Icon name="info" />
        {error}
      </span>
    </div>
  );
}

function CategoryToggles({
  categories,
  selected,
  onChange,
  error,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const toggle = (catId: string) => {
    const on = selected.includes(catId);
    if (on && selected.length === 1) return;
    onChange(on ? selected.filter((s) => s !== catId) : categories.map((c) => c.id).filter((c) => c === catId || selected.includes(c)));
  };
  return (
    <fieldset className="field" data-invalid={error ? "" : undefined}>
      <legend className="field__label">What can students list?</legend>
      <div className="chips cat-toggles">
        {categories.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={on}
              aria-disabled={on && selected.length === 1 ? true : undefined}
              onClick={() => toggle(c.id)}
            >
              {on ? <Icon name="check" /> : null}
              {c.label}
            </button>
          );
        })}
      </div>
      <span className="field__hint">
        {selected.length} of {categories.length} on. Turn off anything your campus doesn&apos;t allow. At least one stays on.
      </span>
      <span className="field__error" role="alert">
        <Icon name="info" />
        {error}
      </span>
    </fieldset>
  );
}

type Logo = { blob: Blob; url: string; before: number };

function LogoPicker({ logo, onChange }: { logo: Logo | null; onChange: (logo: Logo | null) => void }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!LOGO_TYPES.includes(file.type)) return setError("Use a PNG, JPEG or WebP image.");
    if (file.size > LOGO_MAX_INPUT) return setError("That file is over 8 MB. Pick a smaller one.");
    setBusy(true);
    try {
      const blob = await downscaleLogo(file);
      onChange({ blob, url: URL.createObjectURL(blob), before: file.size });
    } catch {
      setError("We couldn't read that image. Try another file.");
    } finally {
      setBusy(false);
    }
  };

  const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div className="field logo-pick" data-invalid={error ? "" : undefined}>
      <span className="field__label" id={`${id}-label`}>
        Logo <span className="logo-pick__opt">optional</span>
      </span>
      <div className="logo-pick__row">
        <label className="photo-add logo-pick__drop" htmlFor={id}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise
            <img src={logo.url} alt="Your logo, resized" width={72} height={72} />
          ) : (
            <>
              <Icon name="image" />
              <b>{busy ? "Resizing…" : "Add logo"}</b>
            </>
          )}
        </label>
        <input
          id={id}
          className="sr-only"
          type="file"
          accept={LOGO_TYPES.join(",")}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="logo-pick__info">
          <span className="field__hint" id={`${id}-hint`}>
            {logo
              ? `Resized to 256 × 256: ${kb(logo.before)} → ${kb(logo.blob.size)}.`
              : "PNG, JPEG or WebP. We resize it to 256 × 256 on your phone before uploading. Without one we use your short name."}
          </span>
          {logo ? (
            <button type="button" className="link link--muted" onClick={() => onChange(null)}>
              Remove logo
            </button>
          ) : null}
        </div>
      </div>
      <span className="field__error" role="alert">
        <Icon name="info" />
        {error}
      </span>
    </div>
  );
}

/* ---------- Gate states ---------- */

function Gate({ icon, title, children, actions }: { icon: IconName; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="panel onb-gate">
      <span className="onb-gate__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <h2>{title}</h2>
      <div className="onb-gate__text">{children}</div>
      <div className="onb-gate__actions">{actions}</div>
    </div>
  );
}

function OnboardingGate({ state }: { state: Exclude<OnboardingState, { kind: "ready" }> }) {
  const router = useRouter();
  switch (state.kind) {
    case "signed-out":
      return (
        <Gate
          icon="user"
          title="Sign in with your college email first"
          actions={
            <>
              <Link className="btn btn--primary" href="/login?next=/start">
                Sign in
              </Link>
              <Link className="btn btn--outline" href="/signup">
                Create an account
              </Link>
            </>
          }
        >
          <p>Your college is identified by your email domain, like @nitc.ac.in. That is also what keeps outsiders out of your marketplace.</p>
        </Gate>
      );
    case "unverified":
      return (
        <Gate
          icon="lock"
          title="Confirm your email to continue"
          actions={
            <>
              <button type="button" className="btn btn--primary" onClick={() => router.refresh()}>
                I&apos;ve confirmed it
              </button>
              <Link className="btn btn--outline" href="/account">
                Resend from your account
              </Link>
            </>
          }
        >
          <p>
            We sent a link to <b>{state.email}</b>. Open it, then come back here. Only confirmed college emails can open a marketplace.
          </p>
        </Gate>
      );
    case "public-domain":
      return (
        <Gate
          icon="info"
          title="Use your college email"
          actions={
            <Link className="btn btn--primary" href="/account">
              Switch email in your account
            </Link>
          }
        >
          <p>
            You&apos;re signed in as <b>{state.email}</b>. Anyone can get an @{state.domain} address, so it can&apos;t prove which college you&apos;re
            from. Each marketplace belongs to one college email domain.
          </p>
        </Gate>
      );
    case "exists":
      return (
        <Gate
          icon="verified"
          title={`${state.college.name} is already here`}
          actions={
            <Link className="btn btn--primary" href={`/c/${state.college.slug}`}>
              Open their marketplace
              <Icon name="arrow" />
            </Link>
          }
        >
          <p>Students with @{state.domain} emails already have a marketplace. Join it instead of starting a second one, so buyers and sellers stay in one place.</p>
        </Gate>
      );
  }
}

/* ---------- The form ---------- */

type Phase = "idle" | "creating" | "logo" | "done";

function ReadyForm({ domain, defaultCategories, categories }: { domain: string; defaultCategories: string[]; categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Values>({
    name: "",
    shortName: "",
    slug: "",
    accent: PLATFORM_ACCENT,
    pickupSpots: PICKUP_SUGGESTIONS,
    categories: defaultCategories,
  });
  const [touched, setTouched] = useState({ shortName: false, slug: false });
  const [logo, setLogo] = useState<Logo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, start] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.url);
  }, [logo]);

  const update = (patch: Partial<Values>) => {
    setValues((v) => ({ ...v, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => errors[k])) {
      setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))));
    }
  };

  const setName = (name: string) => {
    const shortName = touched.shortName ? values.shortName : suggestShortName(name);
    update({ name, shortName, ...(touched.slug ? {} : { slug: slugify(shortName) }) });
  };
  const setShortName = (shortName: string) => {
    setTouched((t) => ({ ...t, shortName: true }));
    update({ shortName, ...(touched.slug ? {} : { slug: slugify(shortName) }) });
  };

  const fail = (fieldErrors: Record<string, string>, message: string) => {
    setErrors(fieldErrors);
    setPhase("idle");
    toast(message, undefined, { type: "error" });
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const uploadLogo = async (collegeId: string, blob: Blob) => {
    const ext = blob.type.split("/")[1] ?? "png";
    const form = new FormData();
    form.append("logo", blob, `logo.${ext}`);
    try {
      const result = await uploadCollegeLogo(collegeId, form);
      return result.ok;
    } catch {
      return false;
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || phase === "done") return;
    const payload = { ...values, name: values.name.trim(), shortName: values.shortName.trim() };
    const local = validateCollege(payload);
    if (Object.keys(local).length) return fail(local, "Check the highlighted fields.");
    start(async () => {
      setPhase("creating");
      let result: Awaited<ReturnType<typeof createCollege>>;
      try {
        // Category ids come from the server-provided list; the action re-validates them with zod.
        result = await createCollege({ ...payload, categories: payload.categories as CreateCollegeInput["categories"] });
      } catch {
        return fail({}, "We couldn't reach the server. Check your connection and try again.");
      }
      if (!result.ok) return fail(result.fields ?? {}, result.error);
      if (logo) {
        setPhase("logo");
        const uploaded = await uploadLogo(result.data.id, logo.blob);
        if (!uploaded) toast("College created, logo upload failed", "Add it in college settings.", { type: "error" });
      }
      setPhase("done");
      toast(`${payload.shortName} is open`, `Students with @${domain} emails can join now.`);
      router.push(`/c/${result.data.slug}?welcome=1`);
    });
  };

  const busy = pending || phase === "done";
  const errorCount = Object.keys(errors).length;
  const label = phase === "logo" ? "Uploading logo…" : phase === "creating" || phase === "done" ? "Opening…" : `Open ${values.shortName.trim() || "your"} marketplace`;

  return (
    <form className="onb" onSubmit={submit} noValidate aria-busy={busy}>
      <div ref={summaryRef} tabIndex={-1} className={`error-summary onb__summary${errorCount ? " is-on" : ""}`} role="alert">
        <Icon name="info" />
        <span>{errorCount === 1 ? "One thing needs fixing." : `${errorCount} things need fixing.`}</span>
      </div>

      <section className="panel onb__sec" aria-labelledby="onb-identity">
        <h2 id="onb-identity" className="onb__h">
          <span className="onb__n">1</span>Your college
        </h2>
        <p className="notice onb__domain">
          <Icon name="shield" />
          <span>
            Students with <b>@{domain}</b> emails will be able to join.
          </span>
        </p>
        <Field id="col-name" label="Full name" error={errors.name}>
          <input
            id="col-name"
            className="input"
            value={values.name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. National Institute of Technology Calicut"
            autoComplete="organization"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("col-name", errors.name, false)}
          />
        </Field>
        <div className="form-grid form-grid--2">
          <Field id="col-short" label="Short name" hint="2 to 12 characters. Shown in the header." error={errors.shortName}>
            <input
              id="col-short"
              className="input"
              value={values.shortName}
              onChange={(e) => setShortName(e.target.value)}
              maxLength={12}
              placeholder="NITC"
              autoComplete="off"
              aria-invalid={errors.shortName ? true : undefined}
              aria-describedby={describedBy("col-short", errors.shortName)}
            />
          </Field>
          <Field
            id="col-slug"
            label="Web address"
            hint={
              <>
                handmedown.app/c/<b className="onb__slug">{values.slug || "your-college"}</b>
              </>
            }
            error={errors.slug}
          >
            <div className="prefix-input onb__slug-input">
              <span aria-hidden="true">/c/</span>
              <input
                id="col-slug"
                className="input"
                value={values.slug}
                onChange={(e) => {
                  setTouched((t) => ({ ...t, slug: true }));
                  update({ slug: cleanSlugInput(e.target.value) });
                }}
                onBlur={() => update({ slug: slugify(values.slug) })}
                maxLength={40}
                placeholder="nitc"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={describedBy("col-slug", errors.slug)}
              />
            </div>
          </Field>
        </div>
      </section>

      <section className="panel onb__sec" aria-labelledby="onb-look">
        <h2 id="onb-look" className="onb__h">
          <span className="onb__n">2</span>How it looks
        </h2>
        <AccentPicker value={values.accent} onChange={(accent) => update({ accent })} error={errors.accent} />
        <LogoPicker
          logo={logo}
          onChange={(next) => {
            setLogo(next);
          }}
        />
      </section>

      <div className="onb__preview">
        <ThemePreview name={values.name} shortName={values.shortName} accent={values.accent} logoUrl={logo?.url ?? null} />
      </div>

      <section className="panel onb__sec" aria-labelledby="onb-campus">
        <h2 id="onb-campus" className="onb__h">
          <span className="onb__n">3</span>Your campus
        </h2>
        <ChipListEditor
          id="col-spots"
          label="Pickup spots"
          items={values.pickupSpots}
          onChange={(pickupSpots) => update({ pickupSpots })}
          placeholder="e.g. Mechanical block parking"
          hint="Busy, public places where students hand things over."
          error={errors.pickupSpots}
        />
        <CategoryToggles
          categories={categories}
          selected={values.categories}
          onChange={(ids) => update({ categories: ids })}
          error={errors.categories}
        />
      </section>

      <div className="onb__submit">
        <p>You become this college&apos;s first admin. You can change the colour, logo and spots later in college settings.</p>
        <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {label}
        </button>
      </div>
    </form>
  );
}

export function OnboardingForm({
  state,
  defaultCategories,
  categories,
}: {
  state: OnboardingState;
  defaultCategories: string[];
  categories: Category[];
}) {
  if (state.kind !== "ready") return <OnboardingGate state={state} />;
  return <ReadyForm domain={state.domain} defaultCategories={defaultCategories} categories={categories} />;
}
