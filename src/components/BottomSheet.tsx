"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PRESETS, rubberBand, Spring, VelocityTracker } from "@/lib/physics";

type Props = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
};

const FOCUSABLE = "button:not([disabled]), input, select, textarea, [href]";

/**
 * Drag the grip (or header) down to dismiss. A quick flick (> 0.5 px/ms) or a pull past
 * 35% of the height closes it; pulling up rubber-bands. Esc and the scrim also close it.
 */
export function BottomSheet({ open, onClose, labelledBy, children }: Props) {
  const sheetRef = useRef<HTMLElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const scrim = scrimRef.current;
    if (!sheet || !scrim) return;
    const opener = document.activeElement as HTMLElement | null;
    const height = sheet.getBoundingClientRect().height + 24;
    let y = height;
    const spring = new Spring(height, PRESETS.sheet, (v) => {
      y = v;
      sheet.style.transform = `translateY(${v}px)`;
      scrim.style.opacity = String(Math.max(0, Math.min(1, 1 - v / height)));
    });
    spring.set(0);
    document.body.style.overflow = "hidden";
    sheet.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

    let closing = false;
    const close = (velocity = 0) => {
      if (closing) return;
      closing = true;
      spring.onRest = () => onCloseRef.current();
      spring.set(height, velocity);
    };

    const vel = new VelocityTracker();
    let start = 0;
    let base = 0;
    let dragging = false;
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".sheet__grip, .sheet__head") || t.closest("button")) return;
      dragging = true;
      start = e.clientY;
      base = y;
      vel.reset();
      sheet.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      vel.add(e.clientY);
      const raw = base + e.clientY - start;
      spring.jump(raw < 0 ? rubberBand(raw, 120) : raw);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      const v = vel.get();
      if (v > 0.5 || y > height * 0.35) close(v * 1000);
      else spring.set(0, v * 1000);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const scrimClick = () => close();
    const closeEvent = () => close();

    sheet.addEventListener("pointerdown", down);
    sheet.addEventListener("pointermove", move);
    sheet.addEventListener("pointerup", up);
    sheet.addEventListener("pointercancel", up);
    sheet.addEventListener("sheet:close", closeEvent);
    scrim.addEventListener("click", scrimClick);
    document.addEventListener("keydown", key);
    return () => {
      spring.stop();
      document.body.style.overflow = "";
      sheet.removeEventListener("pointerdown", down);
      sheet.removeEventListener("pointermove", move);
      sheet.removeEventListener("pointerup", up);
      sheet.removeEventListener("pointercancel", up);
      sheet.removeEventListener("sheet:close", closeEvent);
      scrim.removeEventListener("click", scrimClick);
      document.removeEventListener("keydown", key);
      opener?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div ref={scrimRef} className="sheet-scrim" style={{ opacity: 0 }} />
      <section
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ transform: "translateY(100%)" }}
      >
        <div className="sheet__grip">
          <span />
        </div>
        <div className="sheet__body">{children}</div>
      </section>
    </>,
    document.body,
  );
}

/** Lets content inside the sheet ask it to animate closed (e.g. after "Show 12 listings"). */
export function closeSheetFrom(el: HTMLElement | null) {
  el?.closest(".sheet")?.dispatchEvent(new Event("sheet:close"));
}
