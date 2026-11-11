"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";

const KEY = "hmd-theme";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  window.addEventListener("hmd-theme", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("hmd-theme", onChange);
  };
}

/** Light is the default; dark follows the system unless you pick one here (remembered on this device). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as const);
  const dark = theme === "dark";
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice just won't be remembered.
    }
    window.dispatchEvent(new Event("hmd-theme"));
  };
  return (
    <button
      className="icon-tile"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/** Runs before paint so a saved theme never flashes the wrong colours. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;
