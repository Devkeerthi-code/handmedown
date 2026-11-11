import "server-only";
import type { Category, ListingStatus, PriceType } from "@/generated/prisma/enums";
import { withRls, type Viewer } from "@/lib/db/rls";

export type InboxItem = {
  id: string;
  listingId: string;
  listingTitle: string | null;
  listingStatus: ListingStatus | null;
  listingCategory: Category | null;
  coverPath: string | null;
  otherId: string;
  otherName: string;
  otherVerified: boolean;
  lastBody: string | null;
  lastFromMe: boolean;
  lastMessageAt: string;
  unread: number;
};

type InboxRow = {
  id: string;
  listing_id: string;
  title: string | null;
  status: ListingStatus | null;
  category: Category | null;
  cover_path: string | null;
  other_id: string;
  other_name: string;
  other_verified: boolean;
  last_body: string | null;
  last_sender: string | null;
  last_message_at: Date;
  unread: number;
};

/** Conversations with the other person, the listing, the last message and how many you haven't read. */
export async function getInbox(viewer: Viewer): Promise<InboxItem[]> {
  const rows = await withRls(viewer, (tx) => tx.$queryRaw<InboxRow[]>`
    SELECT c.id, c.listing_id, l.title, l.status::text AS status, l.category::text AS category,
           cover.storage_path AS cover_path,
           other.id AS other_id, other.display_name AS other_name,
           (other.verified_at IS NOT NULL) AS other_verified,
           lm.body AS last_body, lm.sender_id AS last_sender, c.last_message_at,
           (SELECT count(*) FROM app.messages m
             WHERE m.conversation_id = c.id AND m.sender_id <> ${viewer.id}::uuid
               AND m.created_at > coalesce(r.last_read_at, '-infinity'))::int AS unread
    FROM app.conversations c
    JOIN app.profiles other
      ON other.id = CASE WHEN c.buyer_id = ${viewer.id}::uuid THEN c.seller_id ELSE c.buyer_id END
    LEFT JOIN app.listings l ON l.id = c.listing_id
    LEFT JOIN app.conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${viewer.id}::uuid
    LEFT JOIN LATERAL (
      SELECT m.body, m.sender_id FROM app.messages m
      WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT ph.storage_path FROM app.listing_photos ph
      WHERE ph.listing_id = c.listing_id ORDER BY ph.position LIMIT 1
    ) cover ON true
    ORDER BY c.last_message_at DESC
    LIMIT 100`);
  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing_id,
    listingTitle: r.title,
    listingStatus: r.status,
    listingCategory: r.category,
    coverPath: r.cover_path,
    otherId: r.other_id,
    otherName: r.other_name,
    otherVerified: r.other_verified,
    lastBody: r.last_body,
    lastFromMe: r.last_sender === viewer.id,
    lastMessageAt: r.last_message_at.toISOString(),
    unread: r.unread,
  }));
}

export async function getUnreadTotal(viewer: Viewer): Promise<number> {
  const rows = await withRls(viewer, (tx) => tx.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM app.messages m
    JOIN app.conversations c ON c.id = m.conversation_id
    LEFT JOIN app.conversation_reads r ON r.conversation_id = c.id AND r.user_id = ${viewer.id}::uuid
    WHERE m.sender_id <> ${viewer.id}::uuid
      AND m.created_at > coalesce(r.last_read_at, '-infinity')`);
  return rows[0]?.n ?? 0;
}

export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string };

export type Thread = NonNullable<Awaited<ReturnType<typeof getThread>>>;

/** Returns null for anyone who isn't one of the two participants (RLS hides the row). */
export async function getThread(viewer: Viewer, conversationId: string) {
  return withRls(viewer, async (tx) => {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId },
      include: {
        buyer: { select: { id: true, displayName: true, verifiedAt: true } },
        seller: { select: { id: true, displayName: true, verifiedAt: true } },
      },
    });
    if (!conversation) return null;

    const otherId = conversation.buyerId === viewer.id ? conversation.sellerId : conversation.buyerId;
    const [listing, messages, iBlocked, anyBlock] = await Promise.all([
      tx.listing.findUnique({
        where: { id: conversation.listingId },
        select: {
          id: true, title: true, status: true, priceType: true, price: true, category: true,
          pickupSpot: true, isDemo: true,
          photos: { orderBy: { position: "asc" }, take: 1, select: { storagePath: true } },
        },
      }),
      tx.message.findMany({
        where: { conversationId },
        orderBy: { id: "desc" },
        take: 100,
        select: { id: true, senderId: true, body: true, createdAt: true },
      }),
      tx.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: otherId } } }),
      tx.$queryRaw<{ b: boolean }[]>`SELECT app.conversation_is_blocked(${conversationId}::uuid) AS b`,
    ]);

    const other = conversation.buyerId === viewer.id ? conversation.seller : conversation.buyer;
    return {
      id: conversation.id,
      iAmSeller: conversation.sellerId === viewer.id,
      other: { id: other.id, name: other.displayName, verified: other.verifiedAt !== null },
      listing: listing
        ? {
            id: listing.id,
            title: listing.title,
            status: listing.status,
            priceType: listing.priceType as PriceType,
            price: listing.price,
            category: listing.category,
            pickupSpot: listing.pickupSpot,
            isDemo: listing.isDemo,
            coverPath: listing.photos[0]?.storagePath ?? null,
          }
        : null,
      messages: messages.reverse().map<ChatMessage>((m) => ({
        id: m.id.toString(),
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
      iBlocked: iBlocked !== null,
      blocked: anyBlock[0]?.b ?? false,
    };
  });
}
