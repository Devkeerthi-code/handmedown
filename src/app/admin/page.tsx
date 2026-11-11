import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { getReports, getUsageSummary } from "@/lib/admin";
import { categoryOf, tintFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { REPORT_REASONS } from "@/lib/validation";
import { ReportActions } from "@/components/admin/ReportActions";
import { Illustration } from "@/components/Illustration";

export const metadata: Metadata = { title: "Admin" };

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requireMe("/admin");
  if (!me.isAdmin) notFound();
  const tab = (await searchParams).tab === "closed" ? "closed" : "open";
  const [reports, usage] = await Promise.all([getReports(me, tab), getUsageSummary()]);
  const now = new Date();

  return (
    <div className="container page">
      <div className="page__head">
        <h1>Admin</h1>
        <p>Reported listings are hidden automatically until you decide. Usage numbers exclude demo data.</p>
      </div>

      <section aria-labelledby="usageTitle" style={{ marginBottom: "var(--s6)" }}>
        <h2 id="usageTitle" className="panel__title">
          Usage
        </h2>
        <div className="stat-grid">
          <div className="stat-card">
            <b>{usage.people}</b>
            <small>people have used it</small>
          </div>
          <div className="stat-card">
            <b>{usage.last7Days}</b>
            <small>active in the last 7 days</small>
          </div>
          <div className="stat-card">
            <b>{usage.listings}</b>
            <small>listings posted · {usage.sold} handed down</small>
          </div>
          <div className="stat-card">
            <b>{usage.messages}</b>
            <small>messages in {usage.chats} chats · {usage.alerts} alerts</small>
          </div>
        </div>
      </section>

      <div className="admin-head">
        <h2 className="panel__title" style={{ margin: 0 }}>
          Reports
        </h2>
        <div className="chips" role="group" aria-label="Report status">
          <Link className="chip" href="/admin" aria-pressed={tab === "open"}>
            Needs review
          </Link>
          <Link className="chip" href="/admin?tab=closed" aria-pressed={tab === "closed"}>
            Resolved
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="state">
          <div className="state__art">
            <Illustration name="box" />
          </div>
          <h3>{tab === "open" ? "Nothing to review" : "No resolved reports yet"}</h3>
          <p>{tab === "open" ? "When someone reports a listing or a person, it shows up here." : "Decisions you make will be listed here."}</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Reported</th>
              <th scope="col">Reason</th>
              <th scope="col">When</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const l = r.listing;
              const target = l?.seller ?? r.reportedUser;
              return (
                <tr key={r.id}>
                  <td data-label="Reported">
                    {l ? (
                      <div className="rep-item">
                        <span className="rep-item__img" style={{ background: `var(--${tintFor(l.id)})` }}>
                          {l.photos[0] ? (
                            <Image src={photoUrl(l.photos[0].storagePath, "thumb")} alt="" width={44} height={44} unoptimized />
                          ) : (
                            <Illustration name={categoryOf(l.category).art} />
                          )}
                        </span>
                        <div>
                          <Link href={`/l/${l.id}`}>
                            <b>{l.title}</b>
                          </Link>
                          <small>
                            by {l.seller.displayName}
                            {l.isHidden ? " · hidden" : " · visible"}
                            {l._count.reports > 1 ? ` · ${l._count.reports} open reports` : ""}
                            {l.isDemo ? " · demo" : ""}
                          </small>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <b>{r.reportedUser?.displayName ?? "Deleted account"}</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>
                          User report{r.reportedUser?.bannedAt ? " · banned" : ""}
                        </small>
                      </div>
                    )}
                  </td>
                  <td data-label="Reason" className="reason">
                    {reasonLabel(r.reason)}
                    <small>
                      {r.note ? `“${r.note}” · ` : ""}from {r.reporter.displayName}
                    </small>
                  </td>
                  <td data-label="When">
                    {timeAgo(r.createdAt, now)}
                    {r.resolvedAt ? <small style={{ display: "block", color: "var(--muted)" }}>{r.status}</small> : null}
                  </td>
                  <td>
                    {r.status === "open" ? (
                      <ReportActions reportId={r.id} isListing={Boolean(l)} canBan={Boolean(target && !target.bannedAt && target.id !== me.id)} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
