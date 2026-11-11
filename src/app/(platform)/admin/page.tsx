import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { getReports, getUsageSummary } from "@/lib/admin";
import { db } from "@/lib/db/client";
import { requestTime } from "@/lib/format";
import { ReportsTable } from "@/components/admin/ReportsTable";
import { CollegeStatusButton, DomainReview } from "@/components/admin/PlatformActions";

export const metadata: Metadata = { title: "Platform admin" };

/** Platform admin (ADMIN_EMAILS): every college, pending domains, all reports, usage. */
export default async function PlatformAdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requireMe("/admin");
  if (!me.isAdmin) notFound();
  const tab = (await searchParams).tab === "closed" ? "closed" : "open";
  const [reports, usage, colleges, pending] = await Promise.all([
    getReports(me, tab, null),
    getUsageSummary(),
    db.college.findMany({
      orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, slug: true, status: true, isDemo: true,
        _count: { select: { members: true, listings: true } },
      },
    }),
    db.collegeDomain.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { domain: true, createdAt: true, college: { select: { name: true, slug: true } } },
    }),
  ]);

  return (
    <div className="container page" style={{ display: "grid", gap: "var(--s6)" }}>
      <div className="page__head" style={{ marginBottom: 0 }}>
        <h1>Platform admin</h1>
        <p>Every college on HandMeDown. Usage numbers exclude demo data.</p>
      </div>

      <section aria-labelledby="usageTitle">
        <h2 id="usageTitle" className="panel__title">Usage</h2>
        <div className="stat-grid">
          <div className="stat-card"><b>{usage.people}</b><small>people have used it</small></div>
          <div className="stat-card"><b>{usage.last7Days}</b><small>active in the last 7 days</small></div>
          <div className="stat-card"><b>{usage.listings}</b><small>listings posted · {usage.sold} handed down</small></div>
          <div className="stat-card"><b>{colleges.filter((c) => !c.isDemo).length}</b><small>real colleges · {usage.messages} messages</small></div>
        </div>
      </section>

      <section aria-labelledby="pendingTitle">
        <h2 id="pendingTitle" className="panel__title">Domains waiting for approval</h2>
        {pending.length === 0 ? (
          <p className="section__sub">Nothing waiting. Extra domains requested by college admins show up here.</p>
        ) : (
          <table className="table">
            <thead><tr><th scope="col">Domain</th><th scope="col">College</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {pending.map((d) => (
                <tr key={d.domain}>
                  <td data-label="Domain"><b>@{d.domain}</b></td>
                  <td data-label="College"><Link className="link" href={`/c/${d.college.slug}`}>{d.college.name}</Link></td>
                  <td><DomainReview domain={d.domain} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="collegesTitle">
        <h2 id="collegesTitle" className="panel__title">Colleges</h2>
        <table className="table">
          <thead><tr><th scope="col">College</th><th scope="col">Members</th><th scope="col">Listings</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id}>
                <td data-label="College">
                  <Link className="link" href={`/c/${c.slug}`}>{c.name}</Link>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    /c/{c.slug}{c.isDemo ? " · demo" : ""}{c.status === "suspended" ? " · suspended" : ""}
                  </small>
                </td>
                <td data-label="Members">{c._count.members}</td>
                <td data-label="Listings">{c._count.listings}</td>
                <td><div className="rep-actions"><CollegeStatusButton collegeId={c.id} status={c.status} name={c.name} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="reportsTitle">
        <div className="admin-head">
          <h2 className="panel__title" id="reportsTitle" style={{ margin: 0 }}>All reports</h2>
          <div className="chips" role="group" aria-label="Report status">
            <Link className="chip" href="/admin" aria-pressed={tab === "open"}>Needs review</Link>
            <Link className="chip" href="/admin?tab=closed" aria-pressed={tab === "closed"}>Resolved</Link>
          </div>
        </div>
        <ReportsTable reports={reports} meId={me.id} canBan showCollege now={new Date(requestTime())} emptyTitle={tab === "open" ? "Nothing to review" : "No resolved reports yet"} />
      </section>
    </div>
  );
}
