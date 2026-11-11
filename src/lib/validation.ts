import { z } from "zod";
import { CATEGORY_IDS, CONDITION_IDS, PRICE_TYPES } from "@/lib/catalog";
import { normalizeIsbn } from "@/lib/isbn";
import { MAX_PHOTOS } from "@/lib/images/rules";

/** Empty form fields arrive as "" — treat them as "not given". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ message: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} can be at most ${max.toLocaleString("en-IN")}`)
      .optional(),
  );

export const photoRefSchema = z.object({
  path: z.string().min(10).max(200),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
});

export const listingInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a title of at least 3 letters").max(80, "Keep the title under 80 characters"),
    description: z.string().trim().max(1000, "Keep the description under 1,000 characters").default(""),
    category: z.enum(CATEGORY_IDS, { message: "Pick a category" }),
    condition: z.enum(CONDITION_IDS, { message: "Pick a condition" }),
    priceType: z.enum(PRICE_TYPES),
    price: optionalInt(1, 500000, "Price"),
    originalPrice: optionalInt(1, 1000000, "Price when new"),
    exchangeFor: optionalText(80),
    pickupSpot: z.string().trim().min(1, "Pick a place to meet").max(60),
    isbn: optionalText(20),
    bookSemester: optionalInt(1, 10, "Semester"),
    bookSubject: optionalText(60),
    bookAuthor: optionalText(80),
    photos: z.array(photoRefSchema).max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.priceType === "fixed" && v.price === undefined) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price, or choose Free or Exchange" });
    }
    if (v.category === "books" && v.isbn && !normalizeIsbn(v.isbn)) {
      ctx.addIssue({
        code: "custom",
        path: ["isbn"],
        message: "That ISBN doesn't add up. Check the digits on the back cover.",
      });
    }
  })
  .transform((v) => {
    const isBook = v.category === "books";
    return {
      ...v,
      price: v.priceType === "fixed" ? (v.price ?? null) : null,
      originalPrice: v.originalPrice ?? null,
      exchangeFor: v.priceType === "exchange" ? (v.exchangeFor ?? null) : null,
      isbn: isBook && v.isbn ? normalizeIsbn(v.isbn) : null,
      bookSemester: isBook ? (v.bookSemester ?? null) : null,
      bookSubject: isBook ? (v.bookSubject ?? null) : null,
      bookAuthor: isBook ? (v.bookAuthor ?? null) : null,
    };
  });

export type ListingInput = z.input<typeof listingInputSchema>;
export type ListingData = z.output<typeof listingInputSchema>;

export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

const flag = z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean()).catch(false);

export const searchFiltersSchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(80).optional()).catch(undefined),
  category: z.preprocess(blankToUndefined, z.enum(CATEGORY_IDS).optional()).catch(undefined),
  condition: z.preprocess(blankToUndefined, z.enum(CONDITION_IDS).optional()).catch(undefined),
  min: optionalInt(0, 500000, "Min price").catch(undefined),
  max: optionalInt(0, 500000, "Max price").catch(undefined),
  free: flag,
  exchange: flag,
  sort: z.enum(SORTS).catch("newest"),
});
export type SearchFilters = z.output<typeof searchFiltersSchema>;

/** URLSearchParams / Next searchParams -> clean filters. Bad values fall back to defaults instead of erroring. */
export function parseSearchFilters(params: Record<string, string | string[] | undefined>): SearchFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const filters = searchFiltersSchema.parse(flat);
  if (filters.min !== undefined && filters.max !== undefined && filters.min > filters.max) {
    [filters.min, filters.max] = [filters.max, filters.min];
  }
  return filters;
}

export function filtersToQuery(f: Partial<SearchFilters>) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.condition) p.set("condition", f.condition);
  if (f.min !== undefined) p.set("min", String(f.min));
  if (f.max !== undefined) p.set("max", String(f.max));
  if (f.free) p.set("free", "1");
  if (f.exchange) p.set("exchange", "1");
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  return p;
}

export const messageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Type a message first").max(2000, "That message is too long (2,000 characters max)"),
});

export const alertInputSchema = z
  .object({
    query: optionalText(60),
    category: z.preprocess(blankToUndefined, z.enum(CATEGORY_IDS).optional()),
    maxPrice: optionalInt(1, 500000, "Max price"),
    freeOnly: z.boolean().default(false),
  })
  .refine((v) => v.query || v.category || v.maxPrice || v.freeOnly, {
    message: "Tell us at least one thing to watch for",
    path: ["query"],
  })
  .transform((v) => {
    const isbn = v.query ? normalizeIsbn(v.query) : null;
    return { ...v, query: isbn ?? v.query ?? null, category: v.category ?? null, maxPrice: v.maxPrice ?? null };
  });
export type AlertInput = z.input<typeof alertInputSchema>;

export const REPORT_REASONS = [
  { id: "prohibited", label: "Not allowed on campus (alcohol, weapons, etc.)" },
  { id: "scam", label: "Looks like a scam or asks for payment upfront" },
  { id: "misleading", label: "Photos or details are misleading" },
  { id: "offensive", label: "Offensive or harassing" },
  { id: "spam", label: "Spam or duplicate" },
  { id: "other", label: "Something else" },
] as const;

const REPORT_REASON_IDS = REPORT_REASONS.map((r) => r.id) as unknown as [
  (typeof REPORT_REASONS)[number]["id"],
  ...(typeof REPORT_REASONS)[number]["id"][],
];

export const reportSchema = z
  .object({
    listingId: z.string().uuid().optional(),
    reportedUserId: z.string().uuid().optional(),
    reason: z.enum(REPORT_REASON_IDS, { message: "Pick a reason" }),
    note: z.string().trim().max(500, "Keep it under 500 characters").default(""),
  })
  .refine((v) => v.listingId || v.reportedUserId, { message: "Nothing to report" });

export const displayNameSchema = z.string().trim().min(2, "At least 2 letters").max(40, "40 characters max");
export const emailSchema = z.string().trim().toLowerCase().email("That doesn't look like an email address").max(254);
export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(72, "72 characters max");

/** zod issues -> { field: "first message" } for inline form errors. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** The listing must use one of its college's enabled categories and pickup spots. */
export function checkListingAgainstCollege(
  data: { category: string; pickupSpot: string },
  college: { categories: string[]; pickupSpots: string[] },
) {
  const fields: Record<string, string> = {};
  if (!college.categories.includes(data.category)) fields.category = "This college doesn't use that category";
  if (!college.pickupSpots.includes(data.pickupSpot)) fields.pickupSpot = "Pick one of this college's meeting spots";
  return fields;
}

const RESERVED_SLUGS = new Set(["admin", "api", "start", "new", "login", "signup", "account", "c", "settings", "help"]);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(40, "40 characters max")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only")
  .refine((s) => !RESERVED_SLUGS.has(s), "That address is reserved. Try another.");

const spotsSchema = z
  .array(z.string().trim().min(2, "Spot names need 2+ characters").max(60, "Keep spot names under 60 characters"))
  .min(1, "Add at least one meeting spot")
  .max(30, "Up to 30 meeting spots")
  .transform((spots) => [...new Set(spots)]);

const categoriesSchema = z
  .array(z.enum(CATEGORY_IDS))
  .min(1, "Turn on at least one category")
  .transform((c) => [...new Set(c)]);

export const accentSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour").transform((s) => s.toUpperCase());

export const collegeBrandingSchema = z.object({
  name: z.string().trim().min(3, "At least 3 characters").max(80, "80 characters max"),
  shortName: z.string().trim().min(2, "2 to 12 characters").max(12, "2 to 12 characters"),
  accent: accentSchema,
  pickupSpots: spotsSchema,
  categories: categoriesSchema,
});

export const createCollegeSchema = collegeBrandingSchema.extend({ slug: slugSchema });
export type CreateCollegeInput = z.input<typeof createCollegeSchema>;
export type CollegeBrandingInput = z.input<typeof collegeBrandingSchema>;

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^@/, ""))
  .pipe(z.string().regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "That isn't a valid domain, e.g. iitm.ac.in"));
