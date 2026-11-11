/**
 * Tiny damped-spring integrator shared by every physical interaction
 * (semi-implicit Euler, fixed 1/120 s sub-steps): F = -k(x - target) - c·v.
 * With reduced motion turned on, values jump straight to their target.
 */

export type SpringPreset = { k: number; c: number; m?: number };

export const PRESETS = {
  press: { k: 520, c: 26 }, // card / button squash: fast, tiny overshoot
  chip: { k: 640, c: 16 }, // chip pop: visible bounce
  snap: { k: 300, c: 30 }, // gallery settle
  sheet: { k: 380, c: 34 }, // bottom sheet open / return
  stamp: { k: 420, c: 18 }, // SOLD / RESERVED stamp landing
  drift: { k: 50, c: 13 }, // hero circles following the pointer
  toast: { k: 460, c: 30 },
} satisfies Record<string, SpringPreset>;

const STEP = 1 / 120;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export class Spring {
  x: number;
  v = 0;
  target: number;
  k: number;
  c: number;
  m: number;
  onRest: (() => void) | null = null;
  private raf = 0;
  private last = 0;

  constructor(
    value: number,
    preset: SpringPreset,
    private onUpdate: (value: number) => void,
  ) {
    this.x = value;
    this.target = value;
    this.k = preset.k;
    this.c = preset.c;
    this.m = preset.m ?? 1;
  }

  setPreset(p: SpringPreset) {
    this.k = p.k;
    this.c = p.c;
    return this;
  }

  set(target: number, velocity?: number) {
    this.target = target;
    if (typeof velocity === "number") this.v = velocity;
    if (prefersReducedMotion()) {
      this.jump(target);
      return this;
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
    return this;
  }

  jump(value: number) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.x = value;
    this.target = value;
    this.v = 0;
    this.onUpdate(value);
    this.onRest?.();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    let dt = Math.min((now - this.last) / 1000, 0.064);
    this.last = now;
    while (dt > 0) {
      const h = Math.min(STEP, dt);
      const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
      this.v += a * h;
      this.x += this.v * h;
      dt -= h;
    }
    if (Math.abs(this.v) < 0.01 && Math.abs(this.x - this.target) < 0.001) {
      this.x = this.target;
      this.v = 0;
      this.raf = 0;
      this.onUpdate(this.x);
      this.onRest?.();
      return;
    }
    this.onUpdate(this.x);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** iOS-style rubber band: the further you pull past an edge, the harder it resists. */
export function rubberBand(overflow: number, dimension: number) {
  const c = 0.55;
  return (1 - 1 / ((Math.abs(overflow) * c) / dimension + 1)) * dimension * Math.sign(overflow);
}

/** Pointer velocity in px/ms from the last ~80 ms of samples. */
export class VelocityTracker {
  private samples: { x: number; t: number }[] = [];

  reset() {
    this.samples = [];
  }

  add(x: number) {
    const t = performance.now();
    this.samples.push({ x, t });
    while (this.samples.length > 2 && t - this.samples[0].t > 80) this.samples.shift();
  }

  get() {
    const s = this.samples;
    if (s.length < 2) return 0;
    const a = s[0];
    const b = s[s.length - 1];
    return (b.x - a.x) / Math.max(1, b.t - a.t);
  }
}
