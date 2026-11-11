import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getMyListings } from "@/lib/listings/queries";
import { categoryOf, tintFor } from "@/lib/catalog";
import { formatInr, timeAgo } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { DisplayNameForm, SignOutButton } from "@/components/auth/AccountClient";
import { VerifyGate } from "@/components/sell/VerifyGate";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const me = await requireMe("/account");
  const listings = await getMyListings(me);
  const now = new Date();

  return (
    <div className="container page">
      <div className="account">
        <div className="page__head">
          <h1>Hi, {me.displayName}</h1>
          <p>{me.email}</p>
        </div>

        {me.verified && me.collegeSlug ? (
          <section className="panel" aria-labelledby="collegeTitle" style={{ display: "grid", gap: "var(--s3)" }}>
            <h2 className="panel__title" id="collegeTitle" style={{ marginBottom: 0 }}>
              Your college
              <Link className="btn btn--primary btn--sm" href={`/c/${me.collegeSlug}`}>
                Open {me.collegeName}
              </Link>
            </h2>
            <p className="notice" role="status">
              <Icon name="verified" />
              You&apos;re a verified member of {me.collegeName}
              {me.collegeRole ? ` (${me.collegeRole})` : ""}. You can post, chat and set alerts there.
            </p>
            <details>
              <summary className="link link--muted" style={{ cursor: "pointer" }}>Moved to another college?</summary>
              <p className="section__sub">
                Switch your account to your new college email. Once you confirm it, you&apos;ll move to that college.
                Chats from your old college stay with that college.
              </p>
              <VerifyGate />
            </details>
          </section>
        ) : me.banned ? (
          <p className="notice notice--error"><Icon name="ban" />This account can&apos;t post or chat.</p>
        ) : (
          <div className="panel">
            <VerifyGate />
          </div>
        )}

        <section className="panel" aria-labelledby="myListings">
          <h2 className="panel__title" id="myListings">
            Your listings
            {me.collegeSlug ? (
              <Link className="btn btn--primary btn--sm" href={`/c/${me.collegeSlug}/sell`}>
                <Icon name="plus" />
                New
              </Link>
            ) : null}
          </h2>
          {listings.length === 0 ? (
            <p className="section__sub">Nothing listed yet. Graduating soon? Your old books will sell fast.</p>
          ) : (
            <ul className="mine">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link href={`/c/${l.college.slug}/l/${l.id}`}>
                    <span className="mine__img" style={{ background: `var(--${tintFor(l.id)})` }}>
                      {l.photos[0] ? (
                        <Image src={photoUrl(l.photos[0].storagePath, "thumb")} alt="" width={56} height={56} unoptimized />
                      ) : (
                        <Illustration name={categoryOf(l.category).art} />
                      )}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b>{l.title}</b>
                      <small>
                        {l.college.shortName} ·{" "}
                        {l.priceType === "fixed" ? formatInr(l.price ?? 0) : l.priceType === "free" ? "Free" : "Exchange"} ·{" "}
                        {timeAgo(l.createdAt, now)}
                      </small>
                    </span>
                    <span className={`badge ${l.isHidden ? "badge--hidden" : l.status === "sold" ? "badge--sold" : l.status === "reserved" ? "badge--reserved" : "badge--free"}`}>
                      {l.isHidden ? "Under review" : l.status === "sold" ? "Sold" : l.status === "reserved" ? "Reserved" : "Live"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="profileTitle" style={{ display: "grid", gap: "var(--s4)" }}>
          <h2 className="panel__title" id="profileTitle" style={{ marginBottom: 0 }}>Profile</h2>
          <DisplayNameForm initial={me.displayName} />
          <div style={{ display: "flex", gap: "var(--s2)", flexWrap: "wrap" }}>
            <Link className="btn btn--outline btn--sm" href="/account/password">Change password</Link>
            <SignOutButton />
          </div>
        </section>
      </div>
    </div>
  );
}
