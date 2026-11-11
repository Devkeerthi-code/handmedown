import "server-only";
import { db } from "@/lib/db/client";
import { withRls, type Viewer } from "@/lib/db/rls";

/** RLS decides what each viewer may see: college staff get their college, the platform admin gets all. */
export async function getReports(admin: Viewer, status: "open" | "closed", collegeId: string | null) {
  return withRls(admin, (tx) =>
    tx.report.findMany({
      where: {
        ...(collegeId ? { collegeId } : {}),
        ...(status === "open" ? { status: "open" as const } : { status: { not: "open" as const } }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        reason: true,
        note: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        college: { select: { slug: true, shortName: true } },
        reporter: { select: { displayName: true } },
        reportedUser: { select: { id: true, displayName: true, bannedAt: true } },
        listing: {
          select: {
            id: true,
            title: true,
            category: true,
            isHidden: true,
            isDemo: true,
            seller: { select: { id: true, displayName: true, bannedAt: true } },
            photos: { orderBy: { position: "asc" }, take: 1, select: { storagePath: true } },
            _count: { select: { reports: { where: { status: "open" } } } },
          },
        },
      },
    }),
  );
}

export type UsageSummary = {
  people: number;
  signups: number;
  verified: number;
  listings: number;
  sold: number;
  chats: number;
  messages: number;
  alerts: number;
  last7Days: number;
};

/** Honest "used by N people": distinct accounts that did anything, from the privacy-respecting event table. */
export async function getUsageSummary(): Promise<UsageSummary> {
  const [byEvent, people, week] = await Promise.all([
    db.usageEvent.groupBy({ by: ["event"], _count: { _all: true } }),
    db.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT user_id)::int AS n FROM app.usage_events WHERE user_id IS NOT NULL`,
    db.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT user_id)::int AS n FROM app.usage_events
      WHERE user_id IS NOT NULL AND created_at > now() - interval '7 days'`,
  ]);
  const count = (e: string) => byEvent.find((r) => r.event === e)?._count._all ?? 0;
  return {
    people: people[0]?.n ?? 0,
    signups: count("signup"),
    verified: count("verified"),
    listings: count("listing_created"),
    sold: count("listing_sold"),
    chats: count("chat_started"),
    messages: count("message_sent"),
    alerts: count("alert_created"),
    last7Days: week[0]?.n ?? 0,
  };
}
