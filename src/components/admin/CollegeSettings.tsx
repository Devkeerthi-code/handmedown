"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/generated/prisma/enums";
import {
  addCollegeDomain,
  addCollegeStaff,
  removeCollegeDomain,
  removeCollegeStaff,
  updateCollegeBranding,
  uploadCollegeLogo,
} from "@/app/actions/colleges";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { AccentPicker, ChipListEditor, downscaleLogo } from "@/components/college/OnboardingForm";
import { ThemePreview } from "@/components/college/ThemePreview";
import { CATEGORIES } from "@/lib/catalog";

type Branding = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  logoUrl: string | null;
  pickupSpots: string[];
  categories: Category[];
};

/** College admins: name, colours, logo, meeting spots and categories, with the same live preview as onboarding. */
export function BrandingForm({ college }: { college: Branding }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(college.name);
  const [shortName, setShortName] = useState(college.shortName);
  const [accent, setAccent] = useState(college.accent);
  const [spots, setSpots] = useState(college.pickupSpots);
  const [categories, setCategories] = useState<Category[]>(college.categories);
  const [logoUrl, setLogoUrl] = useState(college.logoUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await updateCollegeBranding(college.id, { name, shortName, accent, pickupSpots: spots, categories });
      if (!result.ok) {
        setErrors(result.fields ?? {});
        toast(result.error, undefined, { type: "error" });
        return;
      }
      setErrors({});
      toast("College settings saved");
      router.refresh();
    });
  };

  const changeLogo = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      try {
        const blob = await downscaleLogo(file);
        const form = new FormData();
        form.set("logo", blob);
        const result = await uploadCollegeLogo(college.id, form);
        if (!result.ok) throw new Error(result.error);
        setLogoUrl(result.data.logoUrl);
        toast("Logo updated");
        router.refresh();
      } catch (err) {
        toast("Couldn't update the logo", err instanceof Error ? err.message : undefined, { type: "error" });
      }
    });
  };

  const toggle = (id: Category) =>
    setCategories((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="alerts">
      <form className="panel" onSubmit={save} noValidate style={{ display: "grid", gap: "var(--s4)" }}>
        <div className="field" data-invalid={errors.name ? "" : undefined}>
          <label htmlFor="cname">College name</label>
          <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <span className="field__error" role="alert"><Icon name="info" />{errors.name}</span>
        </div>
        <div className="field" data-invalid={errors.shortName ? "" : undefined}>
          <label htmlFor="cshort">Short name</label>
          <input id="cshort" className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={12} />
          <span className="field__error" role="alert"><Icon name="info" />{errors.shortName}</span>
        </div>
        <AccentPicker value={accent} onChange={setAccent} error={errors.accent} />
        <div className="field">
          <label htmlFor="clogo">Logo (PNG, JPEG or WebP)</label>
          <input id="clogo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => changeLogo(e.target.files?.[0])} disabled={pending} />
        </div>
        <ChipListEditor
          id="cspots"
          label="Meeting spots"
          items={spots}
          onChange={setSpots}
          max={30}
          maxLength={60}
          placeholder="e.g. Central library"
          hint="Sellers pick one of these. Existing listings keep their spot."
          error={errors.pickupSpots}
        />
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Categories</legend>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={categories.includes(c.id)} onClick={() => toggle(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          {errors.categories ? <span className="field__error" style={{ display: "flex" }}>{errors.categories}</span> : null}
        </fieldset>
        <button className="btn btn--primary" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          Save settings
        </button>
      </form>
      <ThemePreview name={name} shortName={shortName} accent={accent} logoUrl={logoUrl} />
    </div>
  );
}

type DomainRow = { domain: string; status: "active" | "pending" };

export function DomainsPanel({ collegeId, domains }: { collegeId: string; domains: DomainRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await addCollegeDomain(collegeId, value);
      if (!result.ok) {
        setError(result.fields?.domain ?? result.error);
        return;
      }
      setError("");
      setValue("");
      toast("Domain requested", "The HandMeDown team will approve it shortly.");
      router.refresh();
    });
  };
  const remove = (domain: string) =>
    start(async () => {
      const result = await removeCollegeDomain(domain);
      if (!result.ok) toast(result.error, undefined, { type: "error" });
      router.refresh();
    });

  return (
    <section className="panel" aria-labelledby="domainsTitle" style={{ display: "grid", gap: "var(--s3)" }}>
      <h2 className="panel__title" id="domainsTitle" style={{ marginBottom: 0 }}>Email domains</h2>
      <p className="section__sub" style={{ marginTop: 0 }}>Anyone who confirms an email on an active domain joins automatically. Subdomains count.</p>
      <ul className="mine">
        {domains.map((d) => (
          <li key={d.domain} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span><b>@{d.domain}</b></span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={`badge ${d.status === "active" ? "badge--verified" : "badge--reserved"}`}>
                {d.status === "active" ? "Active" : "Waiting for approval"}
              </span>
              {d.status === "pending" ? (
                <button className="icon-btn" type="button" onClick={() => remove(d.domain)} aria-label={`Withdraw ${d.domain}`} disabled={pending}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate style={{ display: "grid", gap: 8 }}>
        <div className="field" data-invalid={error ? "" : undefined}>
          <label htmlFor="newDomain">Add another domain</label>
          <input id="newDomain" className="input" placeholder="e.g. alumni.yourcollege.edu.in" value={value} onChange={(e) => setValue(e.target.value)} />
          <span className="field__error" role="alert"><Icon name="info" />{error}</span>
        </div>
        <button className="btn btn--outline btn--sm" type="submit" disabled={pending || !value.trim()} style={{ justifySelf: "start" }}>
          Request domain
        </button>
      </form>
    </section>
  );
}

type StaffRow = { userId: string; name: string; role: "admin" | "moderator"; isMe: boolean };

export function StaffPanel({ collegeId, staff }: { collegeId: string; staff: StaffRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"moderator" | "admin">("moderator");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await addCollegeStaff(collegeId, email, role);
      if (!result.ok) {
        setError(result.fields?.email ?? result.error);
        return;
      }
      setError("");
      setEmail("");
      toast(role === "admin" ? "Admin added" : "Moderator added");
      router.refresh();
    });
  };
  const remove = (userId: string) =>
    start(async () => {
      const result = await removeCollegeStaff(collegeId, userId);
      if (!result.ok) toast(result.error, undefined, { type: "error" });
      router.refresh();
    });

  return (
    <section className="panel" aria-labelledby="staffTitle" style={{ display: "grid", gap: "var(--s3)" }}>
      <h2 className="panel__title" id="staffTitle" style={{ marginBottom: 0 }}>Admins and moderators</h2>
      <p className="section__sub" style={{ marginTop: 0 }}>Moderators handle reports. Admins also manage settings and the team.</p>
      <ul className="mine">
        {staff.map((s) => (
          <li key={s.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span><b>{s.name}{s.isMe ? " (you)" : ""}</b></span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="badge badge--book">{s.role === "admin" ? "Admin" : "Moderator"}</span>
              {!s.isMe ? (
                <button className="icon-btn" type="button" onClick={() => remove(s.userId)} aria-label={`Remove ${s.name}`} disabled={pending}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate style={{ display: "grid", gap: 8 }}>
        <div className="field" data-invalid={error ? "" : undefined}>
          <label htmlFor="staffEmail">Member&apos;s college email</label>
          <input id="staffEmail" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="classmate@yourcollege.edu.in" />
          <span className="field__error" role="alert"><Icon name="info" />{error}</span>
        </div>
        <div className="chips" role="radiogroup" aria-label="Role">
          {(["moderator", "admin"] as const).map((r) => (
            <button key={r} type="button" className="chip" role="radio" aria-checked={role === r} onClick={() => setRole(r)}>
              {r === "admin" ? "Admin" : "Moderator"}
            </button>
          ))}
        </div>
        <button className="btn btn--outline btn--sm" type="submit" disabled={pending || !email.trim()} style={{ justifySelf: "start" }}>
          Add to team
        </button>
      </form>
    </section>
  );
}
