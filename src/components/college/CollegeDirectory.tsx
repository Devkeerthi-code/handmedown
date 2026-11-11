"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { deriveCollegeTheme, themeCssVars } from "@/lib/theme";
import { CollegeLogo } from "./CollegeLogo";

export type DirectoryCollege = {
  slug: string;
  name: string;
  shortName: string;
  accent: string;
  logoUrl: string | null;
  listingCount: number;
  isDemo: boolean;
  status: "active" | "suspended";
};

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every word typed must appear in the name or short name, so "nit calicut" and "nitc" both work. */
export function matchesCollege(c: Pick<DirectoryCollege, "name" | "shortName">, query: string) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = `${fold(c.name)} ${fold(c.shortName)} ${fold(c.shortName).replace(/ /g, "")}`;
  return words.every((w) => hay.includes(w));
}

function listingLabel(n: number) {
  if (n === 0) return "No listings yet";
  return n === 1 ? "1 listing" : `${n.toLocaleString("en-IN")} listings`;
}

function CollegeCard({ college, mine }: { college: DirectoryCollege; mine: boolean }) {
  const style = useMemo(() => themeCssVars(deriveCollegeTheme(college.accent)) as CSSProperties, [college.accent]);
  const paused = college.status === "suspended";
  return (
    <li>
      <article className={`card ccard${mine ? " ccard--mine" : ""}${paused ? " ccard--paused" : ""}`} data-college style={style}>
        <div className="ccard__band" aria-hidden="true">
          <span className="ccard__short">{college.shortName}</span>
        </div>
        <div className="ccard__logo">
          <CollegeLogo name={college.name} shortName={college.shortName} logoUrl={college.logoUrl} size="lg" decorative />
        </div>
        <div className="ccard__body">
          {mine ? <span className="ccard__mine">Your college</span> : null}
          <h3 className="ccard__name">
            <Link href={`/c/${college.slug}`}>{college.name}</Link>
          </h3>
          <p className="ccard__meta">
            <Icon name="tag" />
            {listingLabel(college.listingCount)}
          </p>
          {college.isDemo || paused ? (
            <div className="ccard__badges">
              {college.isDemo ? <span className="badge badge--demo">Demo</span> : null}
              {paused ? <span className="badge badge--hidden">Paused</span> : null}
            </div>
          ) : null}
        </div>
        <span className="ccard__go" aria-hidden="true">
          <Icon name="arrow" />
        </span>
      </article>
    </li>
  );
}

function NoMatch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="state cdir__empty">
      <Illustration name="box" className="state__art" />
      <h3>No college matches “{query}”</h3>
      <p>Check the spelling or try its short name. Not here yet? Any student with a college email can open it in about two minutes.</p>
      <div className="state__actions">
        <Link className="btn btn--primary" href="/start">
          Bring HandMeDown to your college
        </Link>
        <button type="button" className="btn btn--outline" onClick={onClear}>
          Clear search
        </button>
      </div>
    </div>
  );
}

export function CollegeDirectory({
  colleges,
  myCollegeSlug,
}: {
  colleges: DirectoryCollege[];
  myCollegeSlug: string | null;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputId = useId();

  const ordered = useMemo(() => {
    const mine = colleges.filter((c) => c.slug === myCollegeSlug);
    return [...mine, ...colleges.filter((c) => c.slug !== myCollegeSlug)];
  }, [colleges, myCollegeSlug]);
  const shown = useMemo(() => ordered.filter((c) => matchesCollege(c, deferred)), [ordered, deferred]);

  const trimmed = deferred.trim();
  const countText = trimmed
    ? `${shown.length} of ${colleges.length} ${colleges.length === 1 ? "college" : "colleges"} match “${trimmed}”`
    : `${colleges.length} ${colleges.length === 1 ? "college" : "colleges"} on HandMeDown`;

  if (!colleges.length) {
    return (
      <div className="state">
        <Illustration name="box" className="state__art" />
        <h3>No colleges yet</h3>
        <p>Be the first. Sign up with your college email and open your campus marketplace.</p>
        <div className="state__actions">
          <Link className="btn btn--primary" href="/start">
            Bring HandMeDown to your college
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="cdir" aria-labelledby={`${inputId}-label`}>
      <div className="cdir__search" role="search">
        <label id={`${inputId}-label`} htmlFor={inputId} className="field__label">
          Find your college
        </label>
        <div className="input-wrap">
          <Icon name="search" />
          <input
            id={inputId}
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or short name, e.g. NIT Calicut"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" className="cdir__clear" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon name="x" />
            </button>
          ) : null}
        </div>
        <p className="cdir__count" aria-live="polite">
          {countText}
        </p>
      </div>

      {shown.length ? (
        <ul className="cdir__grid">
          {shown.map((c) => (
            <CollegeCard key={c.slug} college={c} mine={c.slug === myCollegeSlug} />
          ))}
        </ul>
      ) : (
        <NoMatch query={trimmed} onClear={() => setQuery("")} />
      )}

      {shown.length ? (
        <p className="cdir__more">
          Not here? <Link className="link" href="/start">Bring HandMeDown to your college</Link>
        </p>
      ) : null}
    </section>
  );
}
