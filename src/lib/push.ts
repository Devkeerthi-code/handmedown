import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db/client";
import { serverEnv } from "@/lib/env";
import { formatInr } from "@/lib/format";
import { logError } from "@/lib/errors";

let configured: boolean | undefined;

function configure() {
  if (configured !== undefined) return configured;
  const env = serverEnv();
  configured = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
  if (configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT!, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }
  return configured;
}

export function pushConfigured() {
  return configure();
}

/**
 * Runs after a listing is posted: finds matching wishlist alerts, records each
 * delivery first (so a retry can never notify twice), then sends web push.
 * Returns how many notifications were sent, for logging and tests.
 */
export async function notifyAlertsForListing(listingId: string): Promise<number> {
  const matches = await db.$queryRaw<{ alert_id: string; user_id: string }[]>`
    SELECT alert_id, user_id FROM app.match_alerts(${listingId}::uuid)`;
  if (matches.length === 0) return 0;

  const recorded = await db.alertDelivery.createManyAndReturn({
    data: matches.map((m) => ({ alertId: m.alert_id, listingId })),
    skipDuplicates: true,
    select: { alertId: true },
  });
  const freshAlerts = new Set(recorded.map((r) => r.alertId));
  const userIds = [...new Set(matches.filter((m) => freshAlerts.has(m.alert_id)).map((m) => m.user_id))];
  if (userIds.length === 0 || !configure()) return 0;

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { title: true, priceType: true, price: true, pickupSpot: true },
  });
  if (!listing) return 0;

  const priceText =
    listing.priceType === "free" ? "Free" : listing.priceType === "exchange" ? "Exchange" : formatInr(listing.price ?? 0);
  const payload = JSON.stringify({
    title: "Something you wanted was just listed",
    body: `${listing.title} · ${priceText} · ${listing.pickupSpot}`,
    url: `/l/${listingId}`,
    tag: `listing-${listingId}`,
  });

  const subscriptions = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 24,
        });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          logError("push", error);
        }
      }
    }),
  );
  return sent;
}
