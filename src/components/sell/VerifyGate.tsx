"use client";

import { useState, useTransition } from "react";
import { verifyCollegeEmail } from "@/app/actions/auth";
import { Icon } from "@/components/Icon";

/** Shown instead of the Sell form to signed-in students who haven't confirmed a college email yet. */
export function VerifyGate({ domains, currentEmail }: { domains: string[]; currentEmail?: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, start] = useTransition();
  const example = domains[0] ? `yourname@${domains[0]}` : "yourname@college.edu.in";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const result = await verifyCollegeEmail(email);
      if (result.ok) setSentTo(email.trim().toLowerCase());
      else setError(result.fields?.email ?? result.error);
    });
  };

  return (
    <div className="lock">
      <span className="lock__icon">
        <Icon name="lock" />
      </span>
      <h1 className="section__title">Verify your college email to post</h1>
      <p className="section__sub" style={{ maxWidth: "46ch" }}>
        Only verified students can sell, so everyone knows they&apos;re dealing with someone from campus. Browsing and
        chatting work without it.
        {currentEmail ? ` You're signed in as ${currentEmail}.` : ""}
      </p>
      {sentTo ? (
        <p className="notice" role="status">
          <Icon name="check" />
          We sent a link to {sentTo}. Open it on this device and you&apos;ll get the Verified badge.
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="field" data-invalid={error ? "" : undefined}>
            <label htmlFor="collegeEmail">College email</label>
            <input
              id="collegeEmail"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={example}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby="collegeEmail-error"
            />
            {domains.length ? (
              <span className="field__hint">Accepted: {domains.map((d) => `@${d}`).join(", ")}</span>
            ) : null}
            <span className="field__error" id="collegeEmail-error" role="alert">
              <Icon name="info" />
              {error}
            </span>
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={pending || !email.trim()}>
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            Send verification link
          </button>
        </form>
      )}
    </div>
  );
}
