"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe } from "@/lib/auth";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { messageSchema } from "@/lib/validation";
import type { ChatMessage } from "@/lib/chat/queries";

const uuid = z.string().uuid();

/** Opens (or reopens) the chat between you and the seller of a listing. */
export async function startConversation(listingId: string): Promise<ActionResult<{ id: string }>> {
  const me = await getMe();
  if (!me) return fail("Sign in to chat with the seller.");
  if (!uuid.safeParse(listingId).success) return fail("That listing doesn't exist.");
  try {
    const id = await withRls(me, async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId }, select: { sellerId: true, status: true } });
      if (!listing) throw new Error("permission denied: listing not visible");
      if (listing.sellerId === me.id) throw new Error("own listing");
      const existing = await tx.conversation.findUnique({
        where: { listingId_buyerId: { listingId, buyerId: me.id } },
        select: { id: true },
      });
      if (existing) return existing.id;
      if (listing.status === "sold") throw new Error("permission denied: sold");
      const created = await tx.conversation.create({
        data: { listingId, buyerId: me.id, sellerId: listing.sellerId },
        select: { id: true },
      });
      return created.id;
    });
    return ok({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "own listing") return fail("This is your own listing.");
    logError("startConversation", error);
    return fail(friendlyError(error));
  }
}

export async function sendMessage(conversationId: string, body: string): Promise<ActionResult<ChatMessage>> {
  const me = await getMe();
  if (!me) return fail("Sign in again to send messages.");
  const parsed = messageSchema.safeParse({ conversationId, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Can't send that.");
  try {
    const message = await withRls(me, (tx) =>
      tx.message.create({
        data: { conversationId, senderId: me.id, body: parsed.data.body },
        select: { id: true, senderId: true, body: true, createdAt: true },
      }),
    );
    return ok({ ...message, id: message.id.toString(), createdAt: message.createdAt.toISOString() });
  } catch (error) {
    logError("sendMessage", error);
    const msg = friendlyError(error);
    return fail(msg === "You're not allowed to do that." ? "You can't message in this chat any more." : msg);
  }
}

export async function markRead(conversationId: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(conversationId).success) return fail("Not signed in.");
  try {
    await withRls(me, (tx) => tx.$executeRaw`
      INSERT INTO app.conversation_reads (conversation_id, user_id, last_read_at)
      VALUES (${conversationId}::uuid, ${me.id}::uuid, now())
      ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()`);
    return ok(null);
  } catch (error) {
    logError("markRead", error);
    return fail(friendlyError(error));
  }
}

export async function blockUser(userId: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  if (!uuid.safeParse(userId).success || userId === me.id) return fail("Can't block that account.");
  try {
    await withRls(me, (tx) => tx.$executeRaw`
      INSERT INTO app.blocks (blocker_id, blocked_id) VALUES (${me.id}::uuid, ${userId}::uuid)
      ON CONFLICT DO NOTHING`);
    revalidatePath("/chats", "layout");
    revalidatePath("/");
    return ok(null);
  } catch (error) {
    logError("blockUser", error);
    return fail(friendlyError(error));
  }
}

export async function unblockUser(userId: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  if (!uuid.safeParse(userId).success) return fail("Can't unblock that account.");
  try {
    await withRls(me, (tx) => tx.block.deleteMany({ where: { blockerId: me.id, blockedId: userId } }));
    revalidatePath("/chats", "layout");
    revalidatePath("/");
    return ok(null);
  } catch (error) {
    logError("unblockUser", error);
    return fail(friendlyError(error));
  }
}
