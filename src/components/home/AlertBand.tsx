"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { parseAlertPhrase } from "@/lib/alert-phrase";

/** The kit's newsletter band, now a wishlist alert. "cycle under 2000" pre-fills the alert form. */
export function AlertBand() {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) {
      toast("Type what you're looking for", "For example: cycle under 2000", { type: "error" });
      return;
    }
    const parsed = parseAlertPhrase(text);
    const params = new URLSearchParams();
    if (parsed.query) params.set("q", parsed.query);
    if (parsed.category) params.set("category", parsed.category);
    if (parsed.maxPrice) params.set("max", String(parsed.maxPrice));
    if (parsed.freeOnly) params.set("free", "1");
    router.push(`/alerts?${params}`);
  };

  return (
    <section className="band" aria-labelledby="bandTitle">
      <div className="container">
        <h2 id="bandTitle">Waiting for something specific?</h2>
        <p>Tell us what you need, like a cycle under ₹2,000, and we&apos;ll notify you the moment someone lists it.</p>
        <form onSubmit={submit} noValidate>
          <label className="sr-only" htmlFor="bandQ">
            What are you looking for?
          </label>
          <input
            className="input"
            id="bandQ"
            placeholder="e.g. Cycle under 2000"
            autoComplete="off"
            maxLength={80}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn btn--primary" type="submit">
            <Icon name="bell" />
            Create alert
          </button>
        </form>
      </div>
    </section>
  );
}
