"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { fieldErrors, reportSchema } from "@/lib/validation";

export async function fileReport(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in to report.");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a reason first.", fieldErrors(parsed.error));
  const { listingId, reportedUserId, reason, note } = parsed.data;
  try {
    await withRls(me, (tx) =>
      tx.report.create({
        data: { reporterId: me.id, listingId: listingId ?? null, reportedUserId: reportedUserId ?? null, reason, note },
        select: { id: true },
      }),
    );
    revalidatePath("/");
    if (listingId) revalidatePath(`/l/${listingId}`);
    return ok(null);
  } catch (error) {
    logError("fileReport", error);
    const msg = friendlyError(error);
    return fail(msg === "That's already been done." ? "You've already reported this. An admin will look at it." : msg);
  }
}

const decisionSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(["restore", "remove", "dismiss", "ban"]),
});

/**
 * restore: listing is fine, show it again and close its reports.
 * remove:  listing stays hidden for good, reports actioned.
 * dismiss: nothing wrong (user reports), close it.
 * ban:     block the reported user (or the listing's seller) from posting and messaging.
 */
export async function resolveReport(reportId: string, decision: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me?.isAdmin) return fail("Only admins can do that.");
  const parsed = decisionSchema.safeParse({ reportId, decision });
  if (!parsed.success) return fail("Unknown action.");
  try {
    await withRls(me, async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { listingId: true, reportedUserId: true, listing: { select: { sellerId: true } } },
      });
      if (!report) throw new Error("permission denied: report not found");
      const resolved = { resolvedBy: me.id, resolvedAt: new Date() };
      const sameTarget = report.listingId
        ? { listingId: report.listingId, status: "open" as const }
        : { id: reportId, status: "open" as const };

      if (parsed.data.decision === "restore" && report.listingId) {
        await tx.listing.update({ where: { id: report.listingId }, data: { isHidden: false } });
        await tx.report.updateMany({ where: sameTarget, data: { status: "dismissed", ...resolved } });
      } else if (parsed.data.decision === "dismiss") {
        await tx.report.updateMany({ where: sameTarget, data: { status: "dismissed", ...resolved } });
      } else {
        await tx.report.updateMany({ where: sameTarget, data: { status: "actioned", ...resolved } });
      }

      if (parsed.data.decision === "ban") {
        const target = report.reportedUserId ?? report.listing?.sellerId;
        if (!target || target === me.id) throw new Error("permission denied: no ban target");
        // Profiles' ban column isn't writable by any client role, so this one write uses the owner connection.
        await db.profile.update({ where: { id: target }, data: { bannedAt: new Date() } });
      }
    });
    revalidatePath("/admin");
    revalidatePath("/");
    return ok(null);
  } catch (error) {
    logError("resolveReport", error);
    return fail(friendlyError(error));
  }
}
