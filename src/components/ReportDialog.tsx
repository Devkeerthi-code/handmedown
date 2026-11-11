"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileReport } from "@/app/actions/reports";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { REPORT_REASONS } from "@/lib/validation";

type Props = {
  listingId?: string;
  reportedUserId?: string;
  label: string;
  trigger: "link" | "menu";
  signedIn: boolean;
  afterReport?: "home" | "stay";
  homeHref?: string;
};

/** Native <dialog>: focus trap, Esc and backdrop come for free and it works on every phone browser. */
export function ReportDialog({ listingId, reportedUserId, label, trigger, signedIn, afterReport = "stay", homeHref = "/" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const titleId = useId();

  const open = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setError("");
    ref.current?.showModal();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError("Pick a reason so the admins know what to check.");
      return;
    }
    start(async () => {
      const result = await fileReport({ listingId, reportedUserId, reason: reason as (typeof REPORT_REASONS)[number]["id"], note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      ref.current?.close();
      toast(
        "Thanks, report sent",
        listingId ? "The listing is hidden until an admin checks it." : "An admin will take a look.",
      );
      if (afterReport === "home") router.replace(homeHref);
      else router.refresh();
    });
  };

  return (
    <>
      {trigger === "link" ? (
        <button className="link link--muted" type="button" onClick={open} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Icon name="flag" />
          {label}
        </button>
      ) : (
        <button type="button" onClick={open}>
          <Icon name="flag" />
          {label}
        </button>
      )}
      <dialog ref={ref} className="dialog" aria-labelledby={titleId}>
        <form className="dialog__panel" onSubmit={submit} noValidate>
          <h2 id={titleId}>{label}</h2>
          <fieldset className="radio-list" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Reason</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.id}>
                <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={`${titleId}-note`}>Anything else? (optional)</label>
            <textarea id={`${titleId}-note`} className="textarea" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error ? (
            <p className="notice notice--error" role="alert">
              <Icon name="info" />
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button className="btn btn--ghost" type="button" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button className="btn btn--primary" type="submit" disabled={pending}>
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              Send report
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
