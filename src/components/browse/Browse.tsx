"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { BottomSheet } from "@/components/BottomSheet";
import { ListingCard, SkeletonCard } from "@/components/listing/ListingCard";
import { categoryOf, CONDITIONS } from "@/lib/catalog";
import type { ListingCardData } from "@/lib/listings/queries";
import { filtersToQuery, type SearchFilters } from "@/lib/validation";
import { FilterSheetBody, PRICE_RANGES, priceRangeOf, type PriceRange } from "./FilterSheet";

type Props = {
  filters: SearchFilters;
  initial: { items: ListingCardData[]; nextCursor: string | null; total: number };
  viewerId: string | null;
  now: number;
};

const QUICK = [
  { key: "free", label: "Free" },
  { key: "exchange", label: "Exchange" },
  { key: "u500", label: "Under ₹500" },
  { key: "like_new", label: "Like new" },
] as const;

function activeFilterCount(f: SearchFilters) {
  return (
    Number(f.min !== undefined || f.max !== undefined) +
    Number(Boolean(f.condition)) +
    Number(f.free) +
    Number(f.exchange) +
    Number(f.sort !== "newest")
  );
}

export function Browse({ filters, initial, viewerId, now }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const queryKey = filtersToQuery(filters).toString();

  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [q, setQ] = useState(filters.q ?? "");
  const [seenKey, setSeenKey] = useState(queryKey);
  const [seenInitial, setSeenInitial] = useState(initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // New server data (filters changed or the page refreshed): start the list over.
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setItems(initial.items);
    setCursor(initial.nextCursor);
    setLoadError(false);
  }
  if (seenKey !== queryKey) {
    setSeenKey(queryKey);
    if ((filters.q ?? "") !== q.trim()) setQ(filters.q ?? "");
  }

  const navigate = useCallback(
    (next: Partial<SearchFilters>) => {
      const merged = { ...filters, ...next };
      const qs = filtersToQuery(merged).toString();
      startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}#listings`, { scroll: false }));
    },
    [filters, pathname, router],
  );

  // Search as you type, debounced so we don't query on every keystroke.
  useEffect(() => {
    const value = q.trim();
    if (value === (filters.q ?? "")) return;
    const t = window.setTimeout(() => navigate({ q: value || undefined }), 300);
    return () => window.clearTimeout(t);
  }, [q, filters.q, navigate]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = filtersToQuery(filters);
      params.set("cursor", cursor);
      const res = await fetch(`/api/listings?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { items: ListingCardData[]; nextCursor: string | null };
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, filters, loadingMore]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor || loadError) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore, loadError]);

  const quickActive = (key: (typeof QUICK)[number]["key"]) => {
    if (key === "free") return filters.free;
    if (key === "exchange") return filters.exchange;
    if (key === "u500") return priceRangeOf(filters) === "u500";
    return filters.condition === "like_new";
  };
  const toggleQuick = (key: (typeof QUICK)[number]["key"]) => {
    const on = !quickActive(key);
    if (key === "free") navigate({ free: on });
    else if (key === "exchange") navigate({ exchange: on });
    else if (key === "u500") navigate(on ? PRICE_RANGES.u500.value : { min: undefined, max: undefined });
    else navigate({ condition: on ? "like_new" : undefined });
  };
  const noFilters =
    !filters.free && !filters.exchange && filters.min === undefined && filters.max === undefined && !filters.condition;

  const clearAll = () => {
    setQ("");
    startTransition(() => router.replace(`${pathname}#listings`, { scroll: false }));
  };

  const searchId = useId();
  const count = activeFilterCount(filters);
  const describe = [filters.category ? categoryOf(filters.category).label : null, filters.q ? `“${filters.q}”` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="toolbar">
        <form className="toolbar__row" role="search" onSubmit={(e) => e.preventDefault()}>
          <div className="input-wrap">
            <label className="sr-only" htmlFor={searchId}>
              Search by title or ISBN
            </label>
            <Icon name="search" />
            <input
              className="input"
              id={searchId}
              type="search"
              placeholder="Search title or ISBN"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={80}
            />
          </div>
          <button
            className="btn btn--outline filters-btn"
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={count ? `Filters and sort, ${count} active` : "Filters and sort"}
          >
            <Icon name="sliders" />
            {count ? <span className="badge-dot">{count}</span> : null}
          </button>
        </form>

        <div className="chips chips--scroll" role="group" aria-label="Quick filters">
          <button className="chip" type="button" aria-pressed={noFilters} onClick={() => navigate({ free: false, exchange: false, min: undefined, max: undefined, condition: undefined })}>
            All
          </button>
          {QUICK.map((c) => (
            <button key={c.key} className="chip" type="button" aria-pressed={quickActive(c.key)} onClick={() => toggleQuick(c.key)}>
              {c.label}
            </button>
          ))}
        </div>

        <DesktopFilters filters={filters} navigate={navigate} />

        <div className="result-line" aria-live="polite">
          <span>
            {pending
              ? "Loading listings…"
              : `${initial.total} listing${initial.total === 1 ? "" : "s"}${describe ? ` for ${describe}` : ""}`}
          </span>
          {describe || count ? (
            <button className="link link--muted" type="button" onClick={clearAll}>
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {pending ? (
        <div className="grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyResults filters={filters} onClear={clearAll} />
      ) : (
        <>
          <div className="grid">
            {items.map((l) => (
              <ListingCard key={l.id} listing={l} viewerId={viewerId} now={now} />
            ))}
            {loadingMore ? Array.from({ length: 4 }, (_, i) => <SkeletonCard key={`sk${i}`} />) : null}
          </div>
          <div className="load-more" ref={sentinelRef}>
            {loadError ? (
              <span>
                Couldn&apos;t load more.{" "}
                <button className="link" type="button" onClick={loadMore}>
                  Try again
                </button>
              </span>
            ) : cursor ? (
              <span className="sr-only">{loadingMore ? "Loading more listings" : ""}</span>
            ) : (
              <span>
                That&apos;s all {items.length} listing{items.length === 1 ? "" : "s"} for now. New ones usually appear in
                the evening.
              </span>
            )}
          </div>
        </>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} labelledBy="filtersTitle">
        <FilterSheetBody filters={filters} onApply={(next) => navigate(next)} />
      </BottomSheet>
    </>
  );
}

function DesktopFilters({
  filters,
  navigate,
}: {
  filters: SearchFilters;
  navigate: (next: Partial<SearchFilters>) => void;
}) {
  return (
    <div className="toolbar__desk">
      <label className="sr-only" htmlFor="fPrice">
        Price range
      </label>
      <select
        className="select"
        id="fPrice"
        value={priceRangeOf(filters)}
        onChange={(e) => navigate(PRICE_RANGES[e.target.value as PriceRange].value)}
      >
        {Object.entries(PRICE_RANGES).map(([key, r]) => (
          <option key={key} value={key}>
            {r.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="fCond">
        Condition
      </label>
      <select
        className="select"
        id="fCond"
        value={filters.condition ?? ""}
        onChange={(e) => navigate({ condition: (e.target.value || undefined) as SearchFilters["condition"] })}
      >
        <option value="">Any condition</option>
        {CONDITIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <span className="sep" aria-hidden="true" />
      <label className="sr-only" htmlFor="fSort">
        Sort by
      </label>
      <select
        className="select"
        id="fSort"
        value={filters.sort}
        onChange={(e) => navigate({ sort: e.target.value as SearchFilters["sort"] })}
      >
        <option value="newest">Newest first</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
      </select>
    </div>
  );
}

function EmptyResults({ filters, onClear }: { filters: SearchFilters; onClear: () => void }) {
  const alertQuery = new URLSearchParams();
  if (filters.q) alertQuery.set("q", filters.q);
  if (filters.category) alertQuery.set("category", filters.category);
  if (filters.max !== undefined) alertQuery.set("max", String(filters.max));
  if (filters.free) alertQuery.set("free", "1");
  return (
    <div className="state">
      <div className="state__art">
        <Illustration name="box" />
      </div>
      <h3>{filters.q ? `Nobody has listed “${filters.q}” yet` : "Nothing matches these filters"}</h3>
      <p>
        Seniors post new things every day, especially near the end of semester. Set an alert and we&apos;ll tell you
        when it shows up.
      </p>
      <div className="state__actions">
        <button className="btn btn--outline btn--sm" type="button" onClick={onClear}>
          Clear filters
        </button>
        <Link className="btn btn--primary btn--sm" href={`/alerts?${alertQuery}`}>
          <Icon name="bell" />
          Alert me when it&apos;s listed
        </Link>
      </div>
    </div>
  );
}
