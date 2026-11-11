import type { Category, Condition, PriceType } from "@/generated/prisma/enums";

export type IllustrationName =
  | "books" | "calculator" | "cycle" | "cooler" | "mattress" | "labcoat" | "kettle"
  | "lamp" | "drafter" | "hoodie" | "headphones" | "bucket" | "box";

export type Tint = "t1" | "t2" | "t3" | "t4" | "t5";

export const CATEGORIES: { id: Category; label: string; art: IllustrationName; tint: Tint }[] = [
  { id: "books", label: "Books", art: "books", tint: "t1" },
  { id: "electronics", label: "Electronics", art: "calculator", tint: "t2" },
  { id: "cycles", label: "Cycles", art: "cycle", tint: "t3" },
  { id: "hostel", label: "Hostel essentials", art: "bucket", tint: "t4" },
  { id: "lab", label: "Lab gear", art: "labcoat", tint: "t5" },
  { id: "clothing", label: "Clothing", art: "hoodie", tint: "t2" },
  { id: "other", label: "Other", art: "lamp", tint: "t1" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [Category, ...Category[]];

export const CONDITIONS: { id: Condition; label: string; hint: string }[] = [
  { id: "like_new", label: "Like new", hint: "Barely used, no marks" },
  { id: "good", label: "Good", hint: "Normal wear, works fine" },
  { id: "fair", label: "Fair", hint: "Visible wear or small issues" },
  { id: "needs_repair", label: "Needs repair", hint: "Something is broken, say what" },
];

export const CONDITION_IDS = CONDITIONS.map((c) => c.id) as [Condition, ...Condition[]];
export const PRICE_TYPES = ["fixed", "free", "exchange"] as const satisfies readonly PriceType[];

export function categoryOf(id: Category) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function conditionLabel(id: Condition) {
  return CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

/** Stable per-listing tint so cards without photos don't all look the same. */
export function tintFor(id: string): Tint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (["t1", "t2", "t3", "t4", "t5"] as const)[h % 5];
}
