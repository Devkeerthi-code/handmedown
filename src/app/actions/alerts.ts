"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe, isMemberOf } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { alertInputSchema, fieldErrors, type AlertInput } from "@/lib/validation";

const uuid = z.string().uuid();

export async function createAlert(collegeId: string, input: AlertInput): Promise<ActionResult<{ id: string }>> {
  const me = await getMe();
  if (!me) return fail("Sign in to create alerts.");
  if (!isMemberOf(me, collegeId)) return fail("Only verified students of this college can set alerts here.");
  const parsed = alertInputSchema.safeParse(input);
  if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
  try {
    const alert = await withRls(me, (tx) =>
      tx.wishlistAlert.create({ data: { ...parsed.data, userId: me.id, collegeId }, select: { id: true } }),
    );
    revalidatePath("/c/[slug]/alerts", "page");
    return ok({ id: alert.id });
  } catch (error) {
    logError("createAlert", error);
    return fail(friendlyError(error));
  }
}

export async function setAlertActive(id: string, active: boolean): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(id).success) return fail("Sign in first.");
  try {
    await withRls(me, (tx) => tx.wishlistAlert.updateMany({ where: { id, userId: me.id }, data: { active: Boolean(active) } }));
    revalidatePath("/c/[slug]/alerts", "page");
    return ok(null);
  } catch (error) {
    logError("setAlertActive", error);
    return fail(friendlyError(error));
  }
}

export async function deleteAlert(id: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(id).success) return fail("Sign in first.");
  try {
    await withRls(me, (tx) => tx.wishlistAlert.deleteMany({ where: { id, userId: me.id } }));
    revalidatePath("/c/[slug]/alerts", "page");
    return ok(null);
  } catch (error) {
    logError("deleteAlert", error);
    return fail(friendlyError(error));
  }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(subscription: unknown): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return fail("Your browser sent an invalid push subscription.");
  const { endpoint, keys } = parsed.data;
  try {
    await withRls(me, async (tx) => {
      // An endpoint belongs to one browser; if it was registered to this user before, replace it.
      await tx.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } });
      await tx.pushSubscription.create({ data: { userId: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth } });
    });
    return ok(null);
  } catch (error) {
    logError("savePushSubscription", error);
    return fail(friendlyError(error));
  }
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  try {
    await withRls(me, (tx) => tx.pushSubscription.deleteMany({ where: { endpoint, userId: me.id } }));
    return ok(null);
  } catch (error) {
    logError("removePushSubscription", error);
    return fail(friendlyError(error));
  }
}
