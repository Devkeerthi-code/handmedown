import Image from "next/image";
import Link from "next/link";
import type { getReports } from "@/lib/admin";
import { categoryOf, tintFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { REPORT_REASONS } from "@/lib/validation";
import { Illustration } from "@/components/Illustration";
import { ReportActions } from "./ReportActions";

type Reports = Awaited<ReturnType<typeof getReports>>;

const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

export function ReportsTable({
  reports,
  meId,
  canBan,
  showCollege,
  now,
  emptyTitle,
}: {
  reports: Reports;
  meId: string;
  canBan: boolean;
  showCollege: boolean;
  now: Date;
  emptyTitle: string;
}) {
  if (reports.length === 0) {
    return (
      <div className="state">
        <div className="state__art">
          <Illustration name="box" />
        </div>
        <h3>{emptyTitle}</h3>
        <p>When someone reports a listing or a person, it shows up here. Reported listings are hidden until you decide.</p>
      </div>
    );
  }
  return (
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
                      <Link href={`/c/${r.college.slug}/l/${l.id}`}>
                        <b>{l.title}</b>
                      </Link>
                      <small>
                        {showCollege ? `${r.college.shortName} · ` : ""}by {l.seller.displayName}
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
                      {showCollege ? `${r.college.shortName} · ` : ""}Person report{r.reportedUser?.bannedAt ? " · banned" : ""}
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
                  <ReportActions
                    reportId={r.id}
                    isListing={Boolean(l)}
                    canBan={canBan && Boolean(target && !target.bannedAt && target.id !== meId)}
                  />
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
