import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isCollegeAdminOf, isStaffOf, requireMe } from "@/lib/auth";
import { getReports } from "@/lib/admin";
import { getCollegeBySlug } from "@/lib/college";
import { db } from "@/lib/db/client";
import { requestTime } from "@/lib/format";
import { ReportsTable } from "@/components/admin/ReportsTable";
import { BrandingForm, DomainsPanel, StaffPanel } from "@/components/admin/CollegeSettings";

export const metadata: Metadata = { title: "Manage college" };

/** College admins and moderators of THIS college (and the platform admin). Everyone else gets a 404. */
export default async function CollegeAdminPage({ params, searchParams }: PageProps<"/c/[slug]/admin">) {
  const college = await getCollegeBySlug((await params).slug);
  if (!college) notFound();
  const base = `/c/${college.slug}`;
  const me = await requireMe(`${base}/admin`);
  const staff = isStaffOf(me, college.id);
  if (!staff && !me.isAdmin) notFound();
  const admin = isCollegeAdminOf(me, college.id) || me.isAdmin;
  const tab = (await searchParams).tab === "closed" ? "closed" : "open";

  const [reports, domains, team] = await Promise.all([
    getReports(me, tab, college.id),
    admin ? db.collegeDomain.findMany({ where: { collegeId: college.id }, orderBy: { createdAt: "asc" }, select: { domain: true, status: true } }) : [],
    admin
      ? db.collegeRoleAssignment.findMany({
          where: { collegeId: college.id },
          orderBy: { createdAt: "asc" },
          select: { userId: true, role: true, user: { select: { displayName: true } } },
        })
      : [],
  ]);

  return (
    <div className="container page" style={{ display: "grid", gap: "var(--s6)" }}>
      <div className="page__head" style={{ marginBottom: 0 }}>
        <h1>Manage {college.shortName}</h1>
        <p>
          {admin ? "Settings, team and reports for your college." : "Reports for your college. Reported listings are hidden until you decide."}
        </p>
      </div>

      <section aria-labelledby="reportsTitle">
        <div className="admin-head">
          <h2 className="panel__title" id="reportsTitle" style={{ margin: 0 }}>Reports</h2>
          <div className="chips" role="group" aria-label="Report status">
            <Link className="chip" href={`${base}/admin`} aria-pressed={tab === "open"}>Needs review</Link>
            <Link className="chip" href={`${base}/admin?tab=closed`} aria-pressed={tab === "closed"}>Resolved</Link>
          </div>
        </div>
        <ReportsTable
          reports={reports}
          meId={me.id}
          canBan={me.isAdmin}
          showCollege={false}
          now={new Date(requestTime())}
          emptyTitle={tab === "open" ? "Nothing to review" : "No resolved reports yet"}
        />
      </section>

      {admin ? (
        <>
          <section aria-labelledby="brandTitle" style={{ display: "grid", gap: "var(--s3)" }}>
            <h2 className="panel__title" id="brandTitle" style={{ margin: 0 }}>Branding and campus</h2>
            <BrandingForm college={college} />
          </section>
          <div className="alerts">
            <DomainsPanel collegeId={college.id} domains={domains} />
            <StaffPanel
              collegeId={college.id}
              staff={team.map((t) => ({ userId: t.userId, name: t.user.displayName, role: t.role, isMe: t.userId === me.id }))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
