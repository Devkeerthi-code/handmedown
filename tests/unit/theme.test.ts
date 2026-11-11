import { describe, expect, it } from "vitest";
import {
  ACCENT_SWATCHES,
  BASE,
  PLATFORM_ACCENT,
  adjustmentOf,
  contrastRatio,
  deriveCollegeTheme,
  hexToOklch,
  parseHex,
  themeCssVars,
  toHex,
} from "@/lib/theme";

/** Deterministic LCG so the "random" inputs are the same on every run. */
function pseudoRandomHexes(count: number, seed = 20261111): string[] {
  let s = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(`#${(s >>> 8).toString(16).padStart(6, "0").toUpperCase()}`);
  }
  return out;
}

const EDGE = ["#FFFFFF", "#000000", "#FFFF00", "#00FF00", "#00FFFF", "#FF00FF", "#808080", "#C88042", "#1F7A8C"];
const INPUTS = [...ACCENT_SWATCHES.map((s) => s.hex), ...EDGE, "#abc", "123456", ...pseudoRandomHexes(200)];

const MODES = {
  light: { bg: BASE.lightBg, surface: BASE.lightSurface, tag: BASE.lightTag, text: BASE.lightText },
  dark: { bg: BASE.darkBg, surface: BASE.darkSurface, tag: BASE.darkTag, text: BASE.darkText },
} as const;

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe("colour maths", () => {
  it("parses and prints hex", () => {
    expect(parseHex("#c88042")).toEqual({ r: 200, g: 128, b: 66 });
    expect(parseHex("fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("red")).toBeNull();
    expect(toHex({ r: 200, g: 128, b: 66 })).toBe("#C88042");
  });

  it("matches WCAG reference ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // Values documented in docs/DESIGN.md
    expect(contrastRatio("#C88042", "#FCF7F0")).toBeCloseTo(2.98, 2);
    expect(contrastRatio("#8F531F", "#FCF7F0")).toBeCloseTo(5.75, 1);
  });
});

describe("deriveCollegeTheme", () => {
  describe.each(Object.entries(MODES))("%s mode", (mode, s) => {
    it.each(INPUTS)("%s meets every contrast rule", (input) => {
      const v = deriveCollegeTheme(input)[mode as keyof typeof MODES];
      for (const ground of [s.bg, s.surface, s.tag, v.accentLight]) {
        expect(contrastRatio(v.accentInk, ground)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(v.onAccent, v.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(v.accent, s.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(v.accent, s.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(s.text, v.accentLight)).toBeGreaterThanOrEqual(7);
      expect(v.ring).toBe(v.accentInk);
      for (const hex of Object.values(v)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  it.each(INPUTS)("%s keeps its hue when saturated", (input) => {
    const theme = deriveCollegeTheme(input);
    const source = hexToOklch(theme.accent);
    if (source.C < 0.08) return;
    for (const v of [theme.light, theme.dark]) {
      for (const hex of [v.accent, v.accentInk]) {
        const out = hexToOklch(hex);
        if (out.C < 0.03) continue; // hue is meaningless near grey
        expect(hueDistance(out.h, source.h)).toBeLessThan(8);
      }
    }
  });

  it("falls back to the platform caramel for invalid input", () => {
    for (const bad of ["", "nope", "#GGGGGG", "#12345", "rgb(1,2,3)"]) {
      const theme = deriveCollegeTheme(bad);
      expect(theme.accent).toBe(PLATFORM_ACCENT);
      expect(theme.input).toBe(bad);
      expect(theme.light).toEqual(deriveCollegeTheme(PLATFORM_ACCENT).light);
    }
  });

  it("is deterministic", () => {
    for (const input of INPUTS.slice(0, 40)) {
      expect(deriveCollegeTheme(input)).toEqual(deriveCollegeTheme(input));
    }
  });

  it("leaves the curated swatches untouched in light mode", () => {
    for (const s of ACCENT_SWATCHES) {
      const theme = deriveCollegeTheme(s.hex);
      expect(adjustmentOf(theme, "light")).toBeNull();
      // Caramel is 2.98:1 on the canvas, so it gets an invisible nudge to 3:1; the rest are exact.
      if (s.hex !== PLATFORM_ACCENT) expect(theme.light.accent).toBe(s.hex);
    }
  });

  it("does not flag the platform caramel as adjusted", () => {
    expect(deriveCollegeTheme(PLATFORM_ACCENT).adjusted).toBe(false);
  });

  it("flags visible nudges and says which way", () => {
    const yellow = deriveCollegeTheme("#FFFF00");
    expect(yellow.adjusted).toBe(true);
    expect(adjustmentOf(yellow, "light")).toBe("darker");
    const black = deriveCollegeTheme("#000000");
    expect(adjustmentOf(black, "dark")).toBe("lighter");
  });
});

describe("themeCssVars", () => {
  it("emits both modes as custom properties", () => {
    const theme = deriveCollegeTheme("#1F7A8C");
    const vars = themeCssVars(theme);
    expect(Object.keys(vars).sort()).toEqual(
      ["accent", "accent-ink", "accent-light", "on-accent", "ring"]
        .flatMap((k) => [`--ca-l-${k}`, `--ca-d-${k}`])
        .sort(),
    );
    expect(vars["--ca-l-accent"]).toBe(theme.light.accent);
    expect(vars["--ca-d-accent-ink"]).toBe(theme.dark.accentInk);
  });
});
