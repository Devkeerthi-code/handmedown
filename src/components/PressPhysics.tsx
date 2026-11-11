"use client";

import { useEffect } from "react";
import { PRESETS, Spring } from "@/lib/physics";

const PRESSABLE = ".btn, .chip, .card, .icon-tile, .cat, .send, .pill-btn, .tabbar a, .photo-add, [data-press]";

/**
 * One listener for the whole app: anything pressable squashes on pointer-down and
 * springs back with a small overshoot on release. Cards press less than buttons
 * because they're "heavier".
 */
export function PressPhysics() {
  useEffect(() => {
    const springs = new WeakMap<HTMLElement, Spring>();
    let pressed: HTMLElement | null = null;

    const springFor = (el: HTMLElement) => {
      let s = springs.get(el);
      if (!s) {
        s = new Spring(1, PRESETS.press, (v) => {
          el.style.transform = v === 1 ? "" : `scale(${v.toFixed(4)})`;
        });
        springs.set(el, s);
      }
      return s;
    };

    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>(PRESSABLE);
      if (!el || el.matches("[disabled], [aria-disabled='true']")) return;
      const inner = target?.closest<HTMLElement>(".btn, .chip");
      const pick = inner && el.classList.contains("card") ? inner : el;
      pressed = pick;
      const heavy = pick.classList.contains("card") || pick.classList.contains("cat");
      springFor(pick).setPreset(PRESETS.press).set(heavy ? 0.975 : 0.94);
    };
    const release = () => {
      if (pressed) springFor(pressed).set(1, 1.6);
      pressed = null;
    };

    document.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    document.addEventListener("dragstart", release);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      document.removeEventListener("dragstart", release);
    };
  }, []);
  return null;
}
