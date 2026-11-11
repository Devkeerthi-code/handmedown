/**
 * Per-college accent colour -> accessible light + dark theme.
 *
 * A college picks any colour. We keep its hue and chroma and only move its
 * lightness (in OKLCH, so the colour still "looks like itself") until every
 * WCAG 2.x pairing the UI relies on passes:
 *
 * - fill (`accent`): >= 3:1 against bg and surface (non-text UI), and some
 *   on-colour (`onAccent`, near-black or white) reaches >= 4.5:1 on it.
 * - `accentLight`: a soft tint at the platform's own accent-light lightness, so
 *   body text stays >= 7:1 on it in both modes.
 * - `accentInk` (links, active nav, focus ring): >= 5:1 (AA is 4.5) on bg,
 *   surface, surface-2, tag and accentLight.
 *
 * Every check runs on the final rounded hex, so the guarantees are exact.
 * `adjusted` is true when the nudge to the fill is visible (OKLab distance >= 0.02,
 * about one just-noticeable difference); sub-JND nudges are applied silently.
 * Pure, deterministic, framework-free.
 */

export type Rgb = { r: number; g: number; b: number };
export type ThemeVars = { accent: string; accentInk: string; onAccent: string; accentLight: string; ring: string };
export type CollegeTheme = { input: string; accent: string; adjusted: boolean; light: ThemeVars; dark: ThemeVars };
type Mode = "light" | "dark";
type Oklch = { L: number; C: number; h: number };

export const PLATFORM_ACCENT = "#C88042";

/** Platform surfaces from src/styles/tokens.css. College colours must work on all of them. */
export const BASE = {
  lightBg: "#FCF7F0",
  lightSurface: "#FFFFFF",
  lightSurface2: "#F6EFE6",
  lightTag: "#E6DCD2",
  lightAccentLightBase: "#F7E7D8",
  lightText: "#261E17",
  lightMutedStrong: "#6B5F55",
  lightOnAccentDark: "#261E17",
  darkBg: "#17110C",
  darkSurface: "#211913",
  darkSurface2: "#2B2119",
  darkTag: "#33261B",
  darkAccentLightBase: "#2E2219",
  darkText: "#F3E9DD",
  darkMutedStrong: "#B5A493",
  darkOnAccentDark: "#17110C",
  onAccentLight: "#FFFFFF",
} as const;

export const MIN = { text: 4.5, ink: 5, ui: 3, tint: 7, mutedOnTint: 4.5 } as const;
const VISIBLE_DELTA = 0.02;

/* ---------- sRGB + WCAG ---------- */

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (l: number) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`contrastRatio: invalid colour "${!ca ? a : b}"`);
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------- OKLab / OKLCH (Björn Ottosson) ---------- */

function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { L, C: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Linear sRGB for an OKLCH colour; may be out of gamut (components outside 0..1). */
function oklchToLinear({ L, C, h }: Oklch): [number, number, number] {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: Oklch) => oklchToLinear(c).every((v) => v >= -1e-5 && v <= 1 + 1e-5);

/** Hex for (L, h) with the requested chroma, reduced only as far as needed to fit sRGB (hue kept). */
function oklchToHex(target: Oklch): string {
  let C = target.C;
  if (!inGamut({ ...target, C })) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut({ ...target, C: mid })) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  const [r, g, b] = oklchToLinear({ ...target, C });
  return toHex({ r: fromLinear(r), g: fromLinear(g), b: fromLinear(b) });
}

export function hexToOklch(hex: string): Oklch {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`hexToOklch: invalid colour "${hex}"`);
  return rgbToOklch(rgb);
}

/** Perceptual distance (Euclidean in OKLab). */
export function deltaE(a: string, b: string): number {
  const x = hexToOklch(a);
  const y = hexToOklch(b);
  const ax = x.C * Math.cos((x.h * Math.PI) / 180);
  const bx = x.C * Math.sin((x.h * Math.PI) / 180);
  const ay = y.C * Math.cos((y.h * Math.PI) / 180);
  const by = y.C * Math.sin((y.h * Math.PI) / 180);
  return Math.hypot(x.L - y.L, ax - ay, bx - by);
}

/* ---------- Derivation ---------- */

function surfaces(mode: Mode) {
  return mode === "light"
    ? { bg: BASE.lightBg, surface: BASE.lightSurface, surface2: BASE.lightSurface2, tag: BASE.lightTag, text: BASE.lightText, muted: BASE.lightMutedStrong, tintBase: BASE.lightAccentLightBase, onDark: BASE.lightOnAccentDark }
    : { bg: BASE.darkBg, surface: BASE.darkSurface, surface2: BASE.darkSurface2, tag: BASE.darkTag, text: BASE.darkText, muted: BASE.darkMutedStrong, tintBase: BASE.darkAccentLightBase, onDark: BASE.darkOnAccentDark };
}

/** Near-black or white, whichever reads better on the fill. Ties go to the platform's dark text. */
export function bestOnColour(fill: string, mode: Mode): string {
  const dark = surfaces(mode).onDark;
  return contrastRatio(fill, dark) >= contrastRatio(fill, BASE.onAccentLight) ? dark : BASE.onAccentLight;
}

/**
 * Walks lightness away from the start in 0.001 steps (both directions, preferred one first)
 * and returns the first hex that passes. L = 0 and L = 1 always pass our checks, so this terminates.
 */
function nearestPassing(start: Oklch, prefer: "darker" | "lighter", passes: (hex: string) => boolean): string {
  const exact = oklchToHex(start);
  if (passes(exact)) return exact;
  for (let i = 1; i <= 1000; i++) {
    const d = i / 1000;
    const order = prefer === "darker" ? [start.L - d, start.L + d] : [start.L + d, start.L - d];
    for (const L of order) {
      if (L < 0 || L > 1) continue;
      const hex = oklchToHex({ ...start, L });
      if (passes(hex)) return hex;
    }
  }
  return prefer === "darker" ? "#000000" : "#FFFFFF";
}

function deriveFill(input: string, mode: Mode): string {
  const s = surfaces(mode);
  const passes = (hex: string) =>
    contrastRatio(hex, s.bg) >= MIN.ui &&
    contrastRatio(hex, s.surface) >= MIN.ui &&
    contrastRatio(hex, bestOnColour(hex, mode)) >= MIN.text;
  if (passes(input)) return input;
  return nearestPassing(hexToOklch(input), mode === "light" ? "darker" : "lighter", passes);
}

const PLATFORM_TINT = { light: hexToOklch(BASE.lightAccentLightBase), dark: hexToOklch(BASE.darkAccentLightBase) };
const PLATFORM_CHROMA = hexToOklch(PLATFORM_ACCENT).C;
const GREY_CHROMA = 0.02;

/** Soft tint at the platform's accent-light lightness; chroma scales with the college colour, capped. */
function deriveTint(accent: string, mode: Mode): string {
  const s = surfaces(mode);
  const base = PLATFORM_TINT[mode];
  const src = hexToOklch(accent);
  const grey = src.C < GREY_CHROMA;
  const h = grey ? base.h : src.h;
  let C = grey ? base.C * 0.5 : Math.min((src.C / PLATFORM_CHROMA) * base.C, base.C * 1.6);
  for (let i = 0; i < 20; i++) {
    const hex = oklchToHex({ L: base.L, C, h });
    if (contrastRatio(hex, s.text) >= MIN.tint && contrastRatio(hex, s.muted) >= MIN.mutedOnTint) return hex;
    C *= 0.8;
  }
  return s.tintBase;
}

function deriveInk(accent: string, tint: string, mode: Mode): string {
  const s = surfaces(mode);
  const grounds = [s.bg, s.surface, s.surface2, s.tag, tint];
  const passes = (hex: string) => grounds.every((g) => contrastRatio(hex, g) >= MIN.ink);
  return nearestPassing(hexToOklch(accent), mode === "light" ? "darker" : "lighter", passes);
}

function deriveMode(accent: string, mode: Mode): ThemeVars {
  const fill = deriveFill(accent, mode);
  const accentLight = deriveTint(accent, mode);
  const accentInk = deriveInk(accent, accentLight, mode);
  return { accent: fill, accentInk, onAccent: bestOnColour(fill, mode), accentLight, ring: accentInk };
}

export function normalizeAccent(input: string): string {
  const rgb = typeof input === "string" ? parseHex(input) : null;
  return rgb ? toHex(rgb) : PLATFORM_ACCENT;
}

export function deriveCollegeTheme(input: string): CollegeTheme {
  const accent = normalizeAccent(input);
  const light = deriveMode(accent, "light");
  const dark = deriveMode(accent, "dark");
  const adjusted = deltaE(accent, light.accent) >= VISIBLE_DELTA || deltaE(accent, dark.accent) >= VISIBLE_DELTA;
  return { input, accent, adjusted, light, dark };
}

/** Which way each mode's fill moved, for the "we adjusted your colour" note. */
export function adjustmentOf(theme: CollegeTheme, mode: Mode): "darker" | "lighter" | null {
  const fill = theme[mode].accent;
  if (deltaE(theme.accent, fill) < VISIBLE_DELTA) return null;
  return hexToOklch(fill).L < hexToOklch(theme.accent).L ? "darker" : "lighter";
}

/** The ratios the preview shows. Each is the worst case for that pairing. */
export function themeContrast(theme: CollegeTheme, mode: Mode) {
  const s = surfaces(mode);
  const v = theme[mode];
  return {
    text: Math.min(...[s.bg, s.surface, v.accentLight].map((g) => contrastRatio(v.accentInk, g))),
    button: contrastRatio(v.onAccent, v.accent),
    fill: Math.min(contrastRatio(v.accent, s.bg), contrastRatio(v.accent, s.surface)),
  };
}

export function themeCssVars(theme: CollegeTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [prefix, v] of [["l", theme.light], ["d", theme.dark]] as const) {
    vars[`--ca-${prefix}-accent`] = v.accent;
    vars[`--ca-${prefix}-accent-ink`] = v.accentInk;
    vars[`--ca-${prefix}-on-accent`] = v.onAccent;
    vars[`--ca-${prefix}-accent-light`] = v.accentLight;
    vars[`--ca-${prefix}-ring`] = v.ring;
  }
  return vars;
}

/**
 * Curated starting points. All pass unchanged in light mode; the deep ones
 * (maroon, forest, navy, plum) are lifted in dark mode so they still read as buttons.
 */
export const ACCENT_SWATCHES = [
  { name: "Caramel", hex: "#C88042" },
  { name: "Brick", hex: "#B5452B" },
  { name: "Maroon", hex: "#8C1D40" },
  { name: "Mustard", hex: "#B8860B" },
  { name: "Forest", hex: "#2F6B45" },
  { name: "Teal", hex: "#1F7A8C" },
  { name: "Navy", hex: "#23408E" },
  { name: "Plum", hex: "#6E3A8C" },
] as const;
