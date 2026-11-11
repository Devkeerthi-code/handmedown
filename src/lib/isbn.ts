/** Strips spaces and hyphens. Returns null if what's left can't be an ISBN. */
function compact(input: string): string | null {
  const s = input.replace(/[\s-]/g, "").toUpperCase();
  return /^(\d{9}[\dX]|\d{13})$/.test(s) ? s : null;
}

function isValid10(s: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = s[i] === "X" ? 10 : Number(s[i]);
    if (s[i] === "X" && i !== 9) return false;
    sum += d * (10 - i);
  }
  return sum % 11 === 0;
}

function check13(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

function isValid13(s: string) {
  return /^97[89]\d{10}$/.test(s) && check13(s.slice(0, 12)) === s[12];
}

/** Accepts ISBN-10 or ISBN-13 (with or without hyphens) and returns the ISBN-13, or null if invalid. */
export function normalizeIsbn(input: string): string | null {
  const s = compact(input);
  if (!s) return null;
  if (s.length === 13) return isValid13(s) ? s : null;
  if (!isValid10(s)) return null;
  const body = "978" + s.slice(0, 9);
  return body + check13(body);
}

/** True when a search box value looks like someone typed an ISBN (so we search by ISBN, not words). */
export function looksLikeIsbn(input: string) {
  return /^[\d\s-]{10,17}[\dxX]?$/.test(input.trim()) && compact(input) !== null;
}

export function formatIsbn(isbn13: string) {
  return `${isbn13.slice(0, 3)}-${isbn13.slice(3, 5)}-${isbn13.slice(5, 9)}-${isbn13.slice(9, 12)}-${isbn13.slice(12)}`;
}
