"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { PRESETS, Spring } from "@/lib/physics";

type Option<T extends string> = { value: T; label: string };

/** Radio group styled as the kit's pill switcher; the white thumb slides between options on a spring. */
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const springRef = useRef<Spring | null>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  useEffect(() => () => springRef.current?.stop(), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    if (!root || !thumb) return;
    const place = () => {
      const width = (root.clientWidth - 8) / options.length;
      thumb.style.width = `${width}px`;
      return 4 + index * width;
    };
    const target = place();
    if (springRef.current) springRef.current.set(target);
    else {
      springRef.current = new Spring(target, PRESETS.chip, (x) => {
        thumb.style.transform = `translateX(${x}px)`;
      });
      springRef.current.jump(target);
    }
    let first = true; // ResizeObserver fires once on observe; don't let that cancel the slide.
    const ro = new ResizeObserver(() => {
      if (first) first = false;
      else springRef.current?.jump(place());
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [index, options.length]);

  return (
    <fieldset ref={rootRef} className="seg" style={{ border: 0, margin: 0 }}>
      <legend className="sr-only">{legend}</legend>
      <span ref={thumbRef} className="seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
