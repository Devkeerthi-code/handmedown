"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { verifyCollegeEmail } from "@/app/actions/auth";
import { Icon } from "@/components/Icon";

/**
 * Joining a college = confirming an email on one of its domains. Shown to signed-in people
 * who aren't a member yet. Changing the account email is how you join or transfer.
 */
export function VerifyGate({ collegeName, currentEmail }: { collegeName?: string; currentEmail?: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ to: string; college: string | null } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const result = await verifyCollegeEmail(email);
      if (result.ok) setSent({ to: email.trim().toLowerCase(), college: result.data.collegeName });
      else setError(result.fields?.email ?? result.error);
    });
  };

  return (
    <div className="lock">
      <span className="lock__icon">
        <Icon name="lock" />
      </span>
      <h1 className="section__title">{collegeName ? `Verify your ${collegeName} email` : "Join your college"}</h1>
      <p className="section__sub" style={{ maxWidth: "48ch" }}>
        Only verified students can post, chat and set alerts, so everyone knows they&apos;re dealing with someone from
        campus. Browsing works without it.
        {currentEmail ? ` You're signed in as ${currentEmail}.` : ""}
      </p>
      {sent ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p className="notice" role="status">
            <Icon name="check" />
            We sent a link to {sent.to}. Open it on this device to finish
            {sent.college ? ` joining ${sent.college}.` : "."}
          </p>
          {!sent.college ? (
            <p className="notice notice--warn">
              <Icon name="info" />
              No college on HandMeDown uses @{sent.to.split("@")[1]} yet. Once you&apos;ve confirmed it, you can
              <Link className="link" href="/start"> bring HandMeDown to your college</Link>.
            </p>
          ) : null}
        </div>
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
              placeholder="yourname@college.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby="collegeEmail-error"
            />
            <span className="field__hint">Your college is recognised from the part after the @.</span>
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
