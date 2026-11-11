"use client";

import { useEffect, useRef, useState } from "react";
import type { ListingStatus } from "@/generated/prisma/enums";
import { PRESETS, Spring } from "@/lib/physics";

const EVENT = "hmd:stamp";

export function announceStamp(status: ListingStatus) {
  window.dispatchEvent(new CustomEvent<ListingStatus>(EVENT, { detail: status }));
}

/**
 * The signature moment: when the seller marks a listing, a rubber stamp drops
 * onto the photo from 2.2× and lands with a wobble.
 */
export function LiveStamp({ initial }: { initial: ListingStatus }) {
  const [status, setStatus] = useState(initial);
  const ref = useRef<HTMLSpanElement>(null);
  const animate = useRef(false);

  useEffect(() => {
    const onStamp = (e: Event) => {
      animate.current = true;
      setStatus((e as CustomEvent<ListingStatus>).detail);
    };
    window.addEventListener(EVENT, onStamp);
    return () => window.removeEventListener(EVENT, onStamp);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate.current) return;
    animate.current = false;
    let scale = 2.2;
    let rot = -22;
    const paint = () => {
      el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
      el.style.opacity = String(Math.min(1, Math.max(0, (2.2 - scale) * 1.4)));
    };
    const s1 = new Spring(2.2, PRESETS.stamp, (v) => ((scale = v), paint())).set(1);
    const s2 = new Spring(-22, PRESETS.stamp, (v) => ((rot = v), paint())).set(-10);
    return () => (s1.stop(), s2.stop());
  }, [status]);

  if (status === "active") return null;
  return (
    <span ref={ref} key={status} className={`stamp stamp--${status} stamp--lg`} aria-hidden="true">
      {status === "sold" ? "Sold" : "Reserved"}
    </span>
  );
}
