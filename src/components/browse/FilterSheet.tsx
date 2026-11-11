"use client";

import { useEffect, useRef, useState } from "react";
import { closeSheetFrom } from "@/components/BottomSheet";
import { CONDITIONS } from "@/lib/catalog";
import { filtersToQuery, type SearchFilters } from "@/lib/validation";

export const PRICE_RANGES = {
  any: { label: "Any price", value: { min: undefined, max: undefined } },
  u500: { label: "Under ₹500", value: { min: undefined, max: 499 } },
  mid: { label: "₹500 – ₹2,000", value: { min: 500, max: 2000 } },
  o2000: { label: "Over ₹2,000", value: { min: 2001, max: undefined } },
} as const;
export type PriceRange = keyof typeof PRICE_RANGES;

export function priceRangeOf(f: Pick<SearchFilters, "min" | "max">): PriceRange {
  const match = (Object.keys(PRICE_RANGES) as PriceRange[]).find(
    (k) => PRICE_RANGES[k].value.min === f.min && PRICE_RANGES[k].value.max === f.max,
  );
  return match ?? "any";
}

/**
 * Mobile filters. Choices are a draft until "Show N listings", and N is fetched
 * live so you never apply your way into an empty page.
 */
export function FilterSheetBody({
  filters,
  onApply,
}: {
  filters: SearchFilters;
  onApply: (next: Partial<SearchFilters>) => void;
}) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [count, setCount] = useState<number | null>(null);
  const footRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = filtersToQuery(draft);
    params.set("count", "1");
    fetch(`/api/listings?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { total?: number } | null) => setCount(d?.total ?? null))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [draft]);

  const set = (next: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...next }));
  const range = priceRangeOf(draft);

  return (
    <>
      <div className="sheet__head">
        <h2 id="filtersTitle">Filters and sort</h2>
        <button className="link link--muted" type="button" onClick={() => setDraft({ ...draft, min: undefined, max: undefined, condition: undefined, free: false, exchange: false, sort: "newest" })}>
          Reset
        </button>
      </div>

      <fieldset className="radio-list" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 8 }}>Price</legend>
        {(Object.keys(PRICE_RANGES) as PriceRange[]).map((k) => (
          <label key={k}>
            <input type="radio" name="price" checked={range === k} onChange={() => set(PRICE_RANGES[k].value)} />
            {PRICE_RANGES[k].label}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={draft.free} onChange={(e) => set({ free: e.target.checked })} />
          Free only
        </label>
        <label>
          <input type="checkbox" checked={draft.exchange} onChange={(e) => set({ exchange: e.target.checked })} />
          Exchange only
        </label>
      </fieldset>

      <fieldset className="radio-list" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 8 }}>Condition</legend>
        <label>
          <input type="radio" name="cond" checked={!draft.condition} onChange={() => set({ condition: undefined })} />
          Any condition
        </label>
        {CONDITIONS.map((c) => (
          <label key={c.id}>
            <input type="radio" name="cond" checked={draft.condition === c.id} onChange={() => set({ condition: c.id })} />
            {c.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="radio-list" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 8 }}>Sort</legend>
        {(
          [
            ["newest", "Newest first"],
            ["price_asc", "Price: low to high"],
            ["price_desc", "Price: high to low"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name="sort" checked={draft.sort === value} onChange={() => set({ sort: value })} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="sheet__foot" ref={footRef}>
        <button className="btn btn--outline" type="button" onClick={() => closeSheetFrom(footRef.current)}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => {
            onApply(draft);
            closeSheetFrom(footRef.current);
          }}
        >
          {count === null ? "Show listings" : `Show ${count} listing${count === 1 ? "" : "s"}`}
        </button>
      </div>
    </>
  );
}
