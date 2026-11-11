"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { PRESETS, Spring, VelocityTracker } from "@/lib/physics";

type ToastOptions = { type?: "success" | "error"; action?: string; onAction?: () => void; ms?: number };
type ToastItem = ToastOptions & { id: number; title: string; sub?: string };
type ToastFn = (title: string, sub?: string, options?: ToastOptions) => void;

const ToastContext = createContext<ToastFn>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ToastFn>((title, sub, options) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { id, title, sub, ...options }]);
  }, []);

  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  return (
    <ToastContext value={toast}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <Toast key={t.id} item={t} onGone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext>
  );
}

/** The kit's success toast, rising on a spring. Swipe sideways to dismiss. */
function Toast({ item, onGone }: { item: ToastItem; onGone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onGoneRef = useRef(onGone);
  useEffect(() => {
    onGoneRef.current = onGone;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = 0;
    let y = 24;
    let gone = false;
    const paint = () => {
      const opacity = Math.max(0, Math.min(1, 1 - y / 24)) * (1 - Math.min(1, Math.abs(x) / 240));
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity = String(opacity);
    };
    const sy = new Spring(24, PRESETS.toast, (v) => {
      y = v;
      paint();
    });
    const sx = new Spring(0, PRESETS.toast, (v) => {
      x = v;
      paint();
    });
    sy.set(0);

    const close = (dir: number) => {
      if (gone) return;
      gone = true;
      const s = dir ? sx : sy;
      s.onRest = () => onGoneRef.current();
      s.set(dir ? dir * 420 : 40);
    };
    let timer = window.setTimeout(() => close(0), item.ms ?? 4200);

    const vel = new VelocityTracker();
    let startX = 0;
    let dragging = false;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragging = true;
      startX = e.clientX - x;
      vel.reset();
      el.setPointerCapture(e.pointerId);
      window.clearTimeout(timer);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      vel.add(e.clientX);
      sx.jump(e.clientX - startX);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      const v = vel.get();
      if (Math.abs(v) > 0.5 || Math.abs(x) > 90) close(Math.sign(x || v));
      else {
        sx.set(0, v * 1000);
        timer = window.setTimeout(() => close(0), 2500);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    const actionBtn = el.querySelector(".toast__action");
    const onAction = () => {
      item.onAction?.();
      close(0);
    };
    actionBtn?.addEventListener("click", onAction);
    return () => {
      window.clearTimeout(timer);
      sx.stop();
      sy.stop();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      actionBtn?.removeEventListener("click", onAction);
    };
  }, [item]);

  const error = item.type === "error";
  return (
    <div ref={ref} className={error ? "toast toast--error" : "toast"} role={error ? "alert" : "status"} style={{ opacity: 0 }}>
      <span className="toast__ic">
        <Icon name={error ? "info" : "check"} />
      </span>
      <div>
        <b>{item.title}</b>
        {item.sub ? <span>{item.sub}</span> : null}
      </div>
      {item.action ? (
        <button className="toast__action" type="button">
          {item.action}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
