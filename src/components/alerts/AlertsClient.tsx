"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/generated/prisma/enums";
import { createAlert, deleteAlert, setAlertActive } from "@/app/actions/alerts";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/Switch";
import { useToast } from "@/components/Toast";
import { CATEGORIES, categoryOf } from "@/lib/catalog";
import { formatInr } from "@/lib/format";

export type AlertRow = {
  id: string;
  query: string | null;
  category: Category | null;
  maxPrice: number | null;
  freeOnly: boolean;
  active: boolean;
  matches: number;
};

type Prefill = { query?: string; category?: string; maxPrice?: string; freeOnly?: boolean };

function describe(a: Pick<AlertRow, "query" | "category" | "maxPrice" | "freeOnly">) {
  const what = a.query ? `“${a.query}”` : a.category ? categoryOf(a.category).label : "Anything";
  const parts = [a.query && a.category ? `in ${categoryOf(a.category).label}` : null];
  if (a.freeOnly) parts.push("free only");
  else if (a.maxPrice) parts.push(`under ${formatInr(a.maxPrice)}`);
  return { what, detail: parts.filter(Boolean).join(" · ") || "any price" };
}

export function AlertsClient({
  alerts,
  prefill,
  collegeId,
  categories,
}: {
  alerts: AlertRow[];
  prefill: Prefill;
  collegeId: string;
  categories: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState(prefill.query ?? "");
  const [category, setCategory] = useState(prefill.category ?? "");
  const [maxPrice, setMaxPrice] = useState(prefill.maxPrice ?? "");
  const [freeOnly, setFreeOnly] = useState(Boolean(prefill.freeOnly));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await createAlert(collegeId, {
        query,
        category: (category || undefined) as Category | undefined,
        maxPrice: freeOnly ? undefined : maxPrice || undefined,
        freeOnly,
      });
      if (!result.ok) {
        setErrors(result.fields ?? {});
        toast(result.error, undefined, { type: "error" });
        return;
      }
      setErrors({});
      setQuery("");
      setCategory("");
      setMaxPrice("");
      setFreeOnly(false);
      toast("Alert saved", "We'll tell you the moment a match is posted.");
      router.refresh();
    });
  };

  const toggle = async (a: AlertRow) => {
    setBusyId(a.id);
    const result = await setAlertActive(a.id, !a.active);
    setBusyId(null);
    if (!result.ok) toast(result.error, undefined, { type: "error" });
    router.refresh();
  };

  const remove = async (a: AlertRow) => {
    setBusyId(a.id);
    const result = await deleteAlert(a.id);
    setBusyId(null);
    if (!result.ok) {
      toast(result.error, undefined, { type: "error" });
      return;
    }
    toast("Alert deleted", undefined, {
      action: "Undo",
      onAction: async () => {
        await createAlert(collegeId, { query: a.query ?? undefined, category: a.category ?? undefined, maxPrice: a.maxPrice ?? undefined, freeOnly: a.freeOnly });
        router.refresh();
      },
    });
    router.refresh();
  };

  return (
    <>
      <form className="alert-form" onSubmit={submit} noValidate>
        <h2>New alert</h2>
        <p>Fill in what matters. Leave the rest empty.</p>
        <div className="field" data-invalid={errors.query ? "" : undefined}>
          <label htmlFor="aq">Keyword, title or ISBN</label>
          <input id="aq" className="input" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} placeholder="e.g. cycle, Grewal, ISBN" aria-describedby="aq-error" />
          <span className="field__error" id="aq-error" role="alert">
            <Icon name="info" />
            {errors.query}
          </span>
        </div>
        <div className="field">
          <label htmlFor="ac">Category</label>
          <select id="ac" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any category</option>
            {CATEGORIES.filter((c) => categories.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" data-invalid={errors.maxPrice ? "" : undefined}>
          <label htmlFor="am">Max price</label>
          <div className="prefix-input">
            <span aria-hidden="true">₹</span>
            <input id="am" className="input" inputMode="numeric" value={freeOnly ? "" : maxPrice} disabled={freeOnly} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="2000" maxLength={6} aria-describedby="am-error" />
          </div>
          <span className="field__error" id="am-error" role="alert">
            <Icon name="info" />
            {errors.maxPrice}
          </span>
        </div>
        <div className="toggle-row">
          <span id="afree">Only free items</span>
          <Switch checked={freeOnly} onChange={setFreeOnly} labelledBy="afree" />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="bell" />}
          Save alert
        </button>
      </form>

      <section aria-labelledby="yourAlerts" style={{ display: "grid", gap: "var(--s3)", alignContent: "start" }}>
        <h2 id="yourAlerts" className="panel__title" style={{ marginBottom: 0 }}>
          Your alerts <span className="section__sub">{alerts.length} of 10</span>
        </h2>
        {alerts.length === 0 ? (
          <div className="state" style={{ padding: "var(--s6) var(--s4)" }}>
            <h3>No alerts yet</h3>
            <p>Make one on the left. A cycle under ₹2,000 is the classic.</p>
          </div>
        ) : (
          <ul className="alert-list">
            {alerts.map((a) => {
              const d = describe(a);
              return (
                <li key={a.id} className="alert-item" data-off={a.active ? undefined : ""} aria-busy={busyId === a.id}>
                  <div>
                    <b>{d.what}</b>
                    <small>
                      {d.detail}
                      {a.matches ? (
                        <>
                          {" · "}
                          <span className="match">
                            {a.matches} match{a.matches === 1 ? "" : "es"} so far
                          </span>
                        </>
                      ) : null}
                    </small>
                  </div>
                  <Switch checked={a.active} onChange={() => toggle(a)} label={`${a.active ? "Pause" : "Resume"} alert for ${d.what}`} disabled={busyId === a.id} />
                  <button className="icon-btn" type="button" onClick={() => remove(a)} aria-label={`Delete alert for ${d.what}`} disabled={busyId === a.id}>
                    <Icon name="trash" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
