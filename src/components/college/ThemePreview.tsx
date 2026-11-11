"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { Segmented } from "@/components/Segmented";
import { PRESETS, Spring } from "@/lib/physics";
import { adjustmentOf, deriveCollegeTheme, themeContrast, themeCssVars, type CollegeTheme } from "@/lib/theme";
import { CollegeLogo } from "./CollegeLogo";

type Mode = "light" | "dark";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const fmt = (n: number) => `${(Math.floor(n * 10) / 10).toFixed(1)}:1`;

function grade(ratio: number, kind: "text" | "ui") {
  if (kind === "ui") return ratio >= 3 ? "UI" : "Low";
  if (ratio >= 7) return "AAA";
  return ratio >= 4.5 ? "AA" : "Low";
}

function Ratio({ label, ratio, kind }: { label: string; ratio: number; kind: "text" | "ui" }) {
  const g = grade(ratio, kind);
  return (
    <li className={`ratio${g === "Low" ? " ratio--low" : ""}`}>
      <span className="ratio__label">{label}</span>
      <span className="ratio__value">
        {fmt(ratio)}
        <span className="ratio__grade">
          <Icon name={g === "Low" ? "info" : "check"} />
          {g}
        </span>
      </span>
    </li>
  );
}

function Ratios({ theme }: { theme: CollegeTheme }) {
  return (
    <div className="tprev__ratios">
      {(["light", "dark"] as const).map((mode) => {
        const c = themeContrast(theme, mode);
        return (
          <div key={mode} className="tprev__ratio-col">
            <h4>{mode === "light" ? "Light mode" : "Dark mode"}</h4>
            <ul>
              <Ratio label="Links and text" ratio={c.text} kind="text" />
              <Ratio label="Button label" ratio={c.button} kind="text" />
              <Ratio label="Button edge" ratio={c.fill} kind="ui" />
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function adjustmentSentence(theme: CollegeTheme) {
  const verb = (d: "darker" | "lighter") => (d === "darker" ? "darkened" : "lightened");
  const light = adjustmentOf(theme, "light");
  const dark = adjustmentOf(theme, "dark");
  if (light && dark) {
    return `We ${verb(light)} your colour slightly for light mode and ${verb(dark)} it for dark mode so text stays readable.`;
  }
  const only = light ?? dark;
  if (!only) return null;
  return `We ${verb(only)} your colour slightly for ${light ? "light" : "dark"} mode so text stays readable.`;
}

function AdjustNote({ theme }: { theme: CollegeTheme }) {
  const sentence = adjustmentSentence(theme);
  if (!theme.adjusted || !sentence) return null;
  const after = (["light", "dark"] as const).filter((m) => adjustmentOf(theme, m));
  return (
    <div className="tprev__adjust" role="status">
      <p>{sentence}</p>
      <div className="tprev__swatches">
        <span className="tswatch">
          <i style={{ background: theme.accent }} />
          Yours
        </span>
        <Icon name="arrow" />
        {after.map((m) => (
          <span key={m} className="tswatch">
            <i style={{ background: theme[m].accent }} />
            {m === "light" ? "Light" : "Dark"}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A soft spring "pop" on the accent pieces whenever the colour changes, so cause and effect are visible. */
function useAccentPop(frameRef: React.RefObject<HTMLDivElement | null>, accent: string) {
  const springRef = useRef<Spring | null>(null);
  const first = useRef(true);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!springRef.current) {
      springRef.current = new Spring(1, PRESETS.chip, (v) => frame.style.setProperty("--pop", v.toFixed(4)));
    }
    if (first.current) {
      first.current = false;
      return;
    }
    const s = springRef.current;
    if (Math.abs(s.v) < 0.4) s.set(1, -2.2);
  }, [accent, frameRef]);
  useEffect(() => () => springRef.current?.stop(), []);
}

export function ThemePreview({
  name,
  shortName,
  accent,
  logoUrl,
}: {
  name: string;
  shortName: string;
  accent: string;
  logoUrl: string | null;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("light");
  const theme = useMemo(() => deriveCollegeTheme(accent), [accent]);
  const style = useMemo(() => themeCssVars(theme) as CSSProperties, [theme]);
  const frameRef = useRef<HTMLDivElement>(null);
  useAccentPop(frameRef, theme.accent);

  const displayName = name.trim() || "Your college";
  const short = shortName.trim() || "College";

  return (
    <section className="tprev" data-college style={style} aria-labelledby={`${id}-title`}>
      <div className="tprev__head">
        <h2 id={`${id}-title`} className="tprev__title">
          Live preview
        </h2>
        <div className="tprev__mode">
          <Segmented name={`${id}-mode`} legend="Preview in" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>
      </div>

      <figure className="tprev__stage">
        <div ref={frameRef} className={`tprev__frame tprev__frame--${mode}`} aria-hidden="true" inert>
          <div className="tprev__bar">
            <CollegeLogo name={displayName} shortName={short} logoUrl={logoUrl} size="sm" decorative />
            <b className="tprev__name">{short}</b>
            <span className="tprev__nav">
              <span aria-current="page">Browse</span>
              <span>
                Chats <span className="count tprev__pop">2</span>
              </span>
            </span>
          </div>
          <div className="tprev__hero">
            <span className="kicker">
              <Icon name="shield" />
              Only for students of {short}
            </span>
            <p className="tprev__h">Pass it on at {displayName}</p>
            <div className="tprev__row">
              <span className="btn btn--accent btn--sm tprev__pop">
                <Icon name="plus" />
                Post a listing
              </span>
              <span className="chip" aria-pressed="false">
                Books
              </span>
            </div>
          </div>
          <div className="card tprev__card">
            <div className="card__img" style={{ background: "var(--t4)" }}>
              <Illustration name="drafter" />
              <div className="card__badges">
                <span className="badge badge--reserved">Reserved</span>
              </div>
            </div>
            <div className="card__body">
              <p className="card__title">Mini drafter with case, used one semester</p>
              <div className="price">
                <b>₹450</b>
                <s>₹1,150 new</s>
              </div>
              <span className="tprev__link">View pickup spot</span>
            </div>
            <span className="btn btn--primary btn--sm btn--block">Chat with seller</span>
          </div>
        </div>
        <figcaption className="tprev__cap">Sample listing, shown only in this preview.</figcaption>
      </figure>

      <AdjustNote theme={theme} />
      <Ratios theme={theme} />
    </section>
  );
}
