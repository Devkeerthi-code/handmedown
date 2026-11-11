"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { fieldErrors, reportSchema } from "@/lib/validation";

/** Reports belong to the college of the listing (or, for a person, the reporter's own college). */
export async function fileReport(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in to report.");
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a reason first.", fieldErrors(parsed.error));
  const { listingId, reportedUserId, reason, note } = parsed.data;
  try {
    const collegeId = listingId
      ? (await db.listing.findUnique({ where: { id: listingId }, select: { collegeId: true } }))?.collegeId
      : me.collegeId;
    if (!collegeId || collegeId !== me.collegeId) {
      return fail("Only verified students of this college can report here.");
    }
    await withRls(me, (tx) =>
      tx.report.create({
        data: {
          reporterId: me.id,
          collegeId,
          listingId: listingId ?? null,
          reportedUserId: reportedUserId ?? null,
          reason,
          note,
        },
        select: { id: true },
      }),
    );
    revalidatePath("/c/[slug]", "layout");
    return ok(null);
  } catch (error) {
    logError("fileReport", error);
    const msg = friendlyError(error);
    return fail(msg === "That's already been done." ? "You've already reported this. A moderator will look at it." : msg);
  }
}

const decisionSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(["restore", "remove", "dismiss", "ban"]),
});

/**
 * restore: listing is fine, show it again and close its reports.
 * remove:  listing stays hidden for good, reports actioned.
 * dismiss: nothing wrong (person reports), close it.
 * ban:     platform admin only; blocks the account from posting and messaging everywhere.
 * College staff can act on their own college's reports (RLS enforces it); the platform admin on any.
 */
export async function resolveReport(reportId: string, decision: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const parsed = decisionSchema.safeParse({ reportId, decision });
  if (!parsed.success) return fail("Unknown action.");
  if (parsed.data.decision === "ban" && !me.isAdmin) return fail("Only the platform admin can ban accounts.");
  try {
    await withRls(me, async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { listingId: true, reportedUserId: true, listing: { select: { sellerId: true } } },
      });
      if (!report) throw new Error("permission denied: report not visible");
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
        const { count } = await tx.report.updateMany({ where: sameTarget, data: { status: "actioned", ...resolved } });
        if (count === 0) throw new Error("permission denied: cannot resolve");
      }

      if (parsed.data.decision === "ban") {
        const target = report.reportedUserId ?? report.listing?.sellerId;
        if (!target || target === me.id) throw new Error("permission denied: no ban target");
        // No client role can write banned_at, so this single write uses the owner connection after the admin check above.
        await db.profile.update({ where: { id: target }, data: { bannedAt: new Date() } });
      }
    });
    revalidatePath("/admin");
    revalidatePath("/c/[slug]", "layout");
    return ok(null);
  } catch (error) {
    logError("resolveReport", error);
    return fail(friendlyError(error));
  }
}
