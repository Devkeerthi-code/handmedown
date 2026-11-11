import type { Metadata } from "next";
import { requireMe } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { AlertsClient, type AlertRow } from "@/components/alerts/AlertsClient";
import { PushPanel } from "@/components/alerts/PushPanel";

export const metadata: Metadata = { title: "Wishlist alerts" };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AlertsPage({ searchParams }: PageProps<"/alerts">) {
  const sp = await searchParams;
  const me = await requireMe("/alerts");
  const rows = await withRls(me, (tx) =>
    tx.wishlistAlert.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        query: true,
        category: true,
        maxPrice: true,
        freeOnly: true,
        active: true,
        _count: { select: { deliveries: true } },
      },
    }),
  );
  const alerts: AlertRow[] = rows.map(({ _count, ...a }) => ({ ...a, matches: _count.deliveries }));

  return (
    <div className="container page">
      <div className="page__head">
        <h1>Wishlist alerts</h1>
        <p>Tell us what you&apos;re hunting for. When a matching listing is posted, you get a notification.</p>
      </div>
      <div className="alerts">
        <PushPanel vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} />
        <AlertsClient
          alerts={alerts}
          prefill={{
            query: first(sp.q)?.slice(0, 60),
            category: first(sp.category),
            maxPrice: first(sp.max)?.replace(/[^\d]/g, "").slice(0, 6),
            freeOnly: first(sp.free) === "1",
          }}
        />
      </div>
    </div>
  );
}
