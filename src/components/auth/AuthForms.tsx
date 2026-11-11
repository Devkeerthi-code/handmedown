"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { Icon } from "@/components/Icon";
import { isPublicEmailDomain } from "@/lib/public-domains";
import { useRouter } from "next/navigation";

function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <div className="field" data-invalid={error ? "" : undefined}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={type === "email" ? "email" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-error${hint ? ` ${id}-hint` : ""}`}
        required
      />
      {hint ? (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      <span className="field__error" id={`${id}-error`} role="alert">
        <Icon name="info" />
        {error}
      </span>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="notice notice--error" role="alert">
      <Icon name="info" />
      {message}
    </p>
  );
}

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState(linkError ? "That link has expired or was already used. Sign in, or ask for a new one." : "");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const result = await signIn({ email, password }, next);
      // Success redirects on the server; we only get here on failure.
      if (result && !result.ok) {
        setFields(result.fields ?? {});
        setError(result.error);
      }
    });
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <FormError message={error} />
      <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} error={fields.email} autoComplete="email" />
      <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} error={fields.password} autoComplete="current-password" hint={<Link className="link" href="/forgot">Forgot it?</Link>} />
      <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        Sign in
      </button>
    </form>
  );
}

export function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const personal = domain !== "" && isPublicEmailDomain(domain);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const result = await signUp({ displayName, email, password });
      if (!result.ok) {
        setFields(result.fields ?? {});
        setError(result.error);
        return;
      }
      if (result.data.needsConfirmation) setSent(true);
      else {
        router.push("/account");
        router.refresh();
      }
    });
  };

  if (sent) {
    return (
      <div className="panel" role="status">
        <p className="notice">
          <Icon name="check" />
          Almost there. We sent a confirmation link to {email}. Open it to finish signing up.
        </p>
        <p className="section__sub">Can&apos;t find it? Check spam, or wait a minute. Links expire after an hour.</p>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <FormError message={error} />
      <TextField id="displayName" label="Your name" value={displayName} onChange={setDisplayName} error={fields.displayName} autoComplete="nickname" hint="Shown to people you chat with. First name is enough." />
      <TextField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={fields.email}
        autoComplete="email"
        hint={
          personal
            ? "That's a personal email: fine for browsing. Use your college email to post and chat."
            : "Use your college email to join your college's marketplace."
        }
      />
      <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} error={fields.password} autoComplete="new-password" hint="At least 8 characters." />
      <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        Create account
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await requestPasswordReset(email);
      if (result.ok) setSent(true);
      else setError(result.fields?.email ?? result.error);
    });
  };

  if (sent) {
    return (
      <p className="notice" role="status">
        <Icon name="check" />
        If there&apos;s an account for {email}, a reset link is on its way.
      </p>
    );
  }
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} error={error} autoComplete="email" />
      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        Send reset link
      </button>
    </form>
  );
}

export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await updatePassword(password);
      if (result.ok) setDone(true);
      else setError(result.fields?.password ?? result.error);
    });
  };

  if (done) {
    return (
      <p className="notice" role="status">
        <Icon name="check" />
        Password updated. You&apos;re signed in.
      </p>
    );
  }
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <TextField id="password" label="New password" type="password" value={password} onChange={setPassword} error={error} autoComplete="new-password" hint="At least 8 characters." />
      <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        Save password
      </button>
    </form>
  );
}
