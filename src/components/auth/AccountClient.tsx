"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut, updateDisplayName } from "@/app/actions/auth";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";

export function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await updateDisplayName(name);
      if (!result.ok) {
        setError(result.fields?.displayName ?? result.error);
        return;
      }
      setError("");
      toast("Name updated");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--s3)" }}>
      <div className="field" data-invalid={error ? "" : undefined}>
        <label htmlFor="displayName">Name shown to others</label>
        <input id="displayName" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-describedby="displayName-error" />
        <span className="field__error" id="displayName-error" role="alert">
          <Icon name="info" />
          {error}
        </span>
      </div>
      <button className="btn btn--outline btn--sm" type="submit" disabled={pending || name.trim() === initial} style={{ justifySelf: "start" }}>
        Save name
      </button>
    </form>
  );
}

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn--ghost" type="button" disabled={pending} onClick={() => start(() => signOut())}>
      Sign out
    </button>
  );
}
