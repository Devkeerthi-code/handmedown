import type { Category } from "@/generated/prisma/enums";

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/\b(cycles?|bikes?|bicycles?)\b/, "cycles"],
  [/\b(books?|textbooks?|novels?)\b/, "books"],
  [/\b(calculators?|laptops?|phones?|headphones?|chargers?|electronics?)\b/, "electronics"],
  [/\b(lab ?coats?|drafters?|aprons?)\b/, "lab"],
  [/\b(mattress(es)?|coolers?|kettles?|buckets?|pillows?|fans?)\b/, "hostel"],
  [/\b(hoodies?|jackets?|shoes?|clothes|clothing)\b/, "clothing"],
];

/**
 * Turns the home page box ("cycle under 2000", "free mattress") into alert fields
 * the alerts form can prefill. Anything we don't recognise stays as the keyword.
 */
export function parseAlertPhrase(text: string) {
  let rest = ` ${text.toLowerCase().trim()} `;
  let maxPrice: number | undefined;
  const price = rest.match(/(?:under|below|less than|upto|up to|max|<)\s*(?:rs\.?|₹|inr)?\s*([\d,]+)\s*(k\b)?/);
  if (price) {
    const n = Number(price[1].replace(/,/g, ""));
    maxPrice = price[2] ? n * 1000 : n;
    rest = rest.replace(price[0], " ");
  }
  const freeOnly = /\bfree\b/.test(rest);
  rest = rest.replace(/\bfree\b/g, " ");
  const category = CATEGORY_WORDS.find(([re]) => re.test(rest))?.[1];
  const query = rest
    .replace(/\b(a|an|the|for|i need|need|want|looking for|any)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    query: query || undefined,
    category,
    maxPrice: maxPrice && maxPrice > 0 ? maxPrice : undefined,
    freeOnly,
  };
}
