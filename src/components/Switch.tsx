"use client";

import { useEffect, useRef } from "react";
import { PRESETS, Spring } from "@/lib/physics";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
};

/** role="switch" with a thumb that bounces across on a spring. */
export function Switch({ checked, onChange, label, labelledBy, disabled }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const spring = useRef<Spring | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = checked ? 20 : 0;
    if (!spring.current) {
      spring.current = new Spring(target, PRESETS.chip, (x) => el.style.setProperty("--x", `${x}px`));
      spring.current.jump(target);
    } else spring.current.set(target);
  }, [checked]);

  useEffect(() => () => spring.current?.stop(), []);

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}
