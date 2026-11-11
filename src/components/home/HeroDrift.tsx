"use client";

import { useEffect } from "react";
import { PRESETS, prefersReducedMotion, Spring } from "@/lib/physics";

/**
 * The hero's big circles lean toward the pointer (desktop) and drift with scroll,
 * each at its own depth (data-drift), on soft springs. Off with reduced motion.
 */
export function HeroDrift() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const hero = document.querySelector<HTMLElement>(".hero");
    if (!hero) return;
    const items = Array.from(hero.querySelectorAll<HTMLElement>("[data-drift]")).map((el) => {
      const depth = Number(el.dataset.drift ?? 1);
      const pos = { x: 0, y: 0 };
      const paint = () => {
        el.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0)`;
      };
      return {
        depth,
        sx: new Spring(0, PRESETS.drift, (v) => ((pos.x = v), paint())),
        sy: new Spring(0, PRESETS.drift, (v) => ((pos.y = v), paint())),
      };
    });

    let pointerY = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      pointerY = (e.clientY - r.top) / r.height - 0.5;
      items.forEach((it) => {
        it.sx.set(nx * 24 * it.depth);
        it.sy.set(pointerY * 18 * it.depth - window.scrollY * 0.08 * it.depth);
      });
    };
    const onScroll = () => {
      items.forEach((it) => it.sy.set(pointerY * 18 * it.depth - window.scrollY * 0.08 * it.depth));
    };
    hero.addEventListener("pointermove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      hero.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      items.forEach((it) => (it.sx.stop(), it.sy.stop()));
    };
  }, []);
  return null;
}
