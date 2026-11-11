import "server-only";
import { cache } from "react";
import type { Category, Condition, ListingStatus, PriceType } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { withRls, type Tx, type Viewer } from "@/lib/db/rls";
import { encodeCursor, type Cursor } from "@/lib/cursor";
import type { SearchFilters } from "@/lib/validation";
import { buildCountQuery, buildSearchQuery, PAGE_SIZE } from "./search-sql";

export type PhotoRef = { path: string; width: number; height: number };

export type ListingCardData = {
  id: string;
  title: string;
  category: Category;
  condition: Condition;
  priceType: PriceType;
  price: number | null;
  originalPrice: number | null;
  exchangeFor: string | null;
  pickupSpot: string;
  status: ListingStatus;
  isDemo: boolean;
  createdAt: string;
  isbn: string | null;
  sellerId: string;
  cover: PhotoRef | null;
};

type Row = {
  id: string;
  title: string;
  category: Category;
  condition: Condition;
  price_type: PriceType;
  price: number | null;
  original_price: number | null;
  exchange_for: string | null;
  pickup_spot: string;
  status: ListingStatus;
  is_demo: boolean;
  created_at: Date;
  isbn: string | null;
  seller_id: string;
  cover_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
  sort_value: string;
};

function toCard(r: Row): ListingCardData {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    condition: r.condition,
    priceType: r.price_type,
    price: r.price,
    originalPrice: r.original_price,
    exchangeFor: r.exchange_for,
    pickupSpot: r.pickup_spot,
    status: r.status,
    isDemo: r.is_demo,
    createdAt: r.created_at.toISOString(),
    isbn: r.isbn,
    sellerId: r.seller_id,
    cover: r.cover_path ? { path: r.cover_path, width: r.cover_width ?? 1, height: r.cover_height ?? 1 } : null,
  };
}

export type ListingPage = { items: ListingCardData[]; nextCursor: string | null };

export async function searchListingsTx(
  tx: Tx,
  filters: SearchFilters,
  cursor: Cursor | null,
  viewerId: string | null,
  collegeId: string,
  limit = PAGE_SIZE,
): Promise<ListingPage> {
  const rows = await tx.$queryRaw<Row[]>(buildSearchQuery(filters, cursor, viewerId, collegeId, limit));
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toCard),
    nextCursor: hasMore && last ? encodeCursor({ v: last.sort_value, id: last.id }) : null,
  };
}

export function searchListings(viewer: Viewer | null, collegeId: string, filters: SearchFilters, cursor: Cursor | null) {
  return withRls(viewer, (tx) => searchListingsTx(tx, filters, cursor, viewer?.id ?? null, collegeId));
}

export async function countListings(viewer: Viewer | null, collegeId: string, filters: SearchFilters) {
  const rows = await withRls(viewer, (tx) =>
    tx.$queryRaw<{ n: number }[]>(buildCountQuery(filters, viewer?.id ?? null, collegeId)),
  );
  return rows[0]?.n ?? 0;
}

/** First page + total, in one transaction, for the home page server render. */
export function firstPage(viewer: Viewer | null, collegeId: string, filters: SearchFilters) {
  return withRls(viewer, async (tx) => {
    const page = await searchListingsTx(tx, filters, null, viewer?.id ?? null, collegeId);
    const [count] = await tx.$queryRaw<{ n: number }[]>(buildCountQuery(filters, viewer?.id ?? null, collegeId));
    return { ...page, total: count?.n ?? 0 };
  });
}

export type ListingDetail = Awaited<ReturnType<typeof getListingDetail>>;

/** Cached per request so metadata and the page share one query. */
export const getListingDetail = cache(async (viewer: Viewer | null, id: string) => {
  return withRls(viewer, async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { position: "asc" }, select: { storagePath: true, width: true, height: true } },
        seller: { select: { id: true, displayName: true, verifiedAt: true, isDemo: true, createdAt: true } },
      },
    });
    if (!listing) return null;

    const isOwner = viewer?.id === listing.sellerId;
    // Sequential on purpose: a transaction is one connection, and pg rejects overlapping queries on it.
    const handedDown = await tx.listing.count({ where: { sellerId: listing.sellerId, status: "sold" } });
    const asBuyer = viewer && !isOwner ? viewer : null;
    const conversation = asBuyer
      ? await tx.conversation.findUnique({
          where: { listingId_buyerId: { listingId: id, buyerId: asBuyer.id } },
          select: { id: true },
        })
      : null;
    const blocked = asBuyer
      ? await tx.$queryRaw<{ b: boolean }[]>`SELECT app.is_blocked_between(${asBuyer.id}::uuid, ${listing.sellerId}::uuid) AS b`
      : [{ b: false }];

    return {
      ...listing,
      photos: listing.photos.map((p) => ({ path: p.storagePath, width: p.width, height: p.height })),
      isOwner,
      sellerHandedDown: handedDown,
      conversationId: conversation?.id ?? null,
      blocked: blocked[0]?.b ?? false,
    };
  });
});

export async function getListingForEdit(viewer: Viewer, id: string) {
  return withRls(viewer, (tx) =>
    tx.listing.findFirst({
      where: { id, sellerId: viewer.id },
      include: { photos: { orderBy: { position: "asc" } } },
    }),
  );
}

export async function getMyListings(viewer: Viewer) {
  return withRls(viewer, (tx) =>
    tx.listing.findMany({
      where: { sellerId: viewer.id },
      include: { college: { select: { slug: true, shortName: true } }, photos: { orderBy: { position: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  );
}

export type CampusStats = { live: number; handedDown: number; verified: number };

/** Honest live numbers for a college hero. Demo listings and accounts are excluded. */
export async function getCampusStats(collegeId: string): Promise<CampusStats> {
  const [live, handedDown, verified] = await Promise.all([
    db.listing.count({ where: { collegeId, isHidden: false, isDemo: false, status: { not: "sold" } } }),
    db.listing.count({ where: { collegeId, isDemo: false, status: "sold" } }),
    db.profile.count({ where: { collegeId, isDemo: false, bannedAt: null } }),
  ]);
  return { live, handedDown, verified };
}

export async function getCategoryCounts(collegeId: string): Promise<Partial<Record<Category, number>>> {
  const rows = await db.listing.groupBy({
    by: ["category"],
    where: { collegeId, isHidden: false, status: { not: "sold" } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all]));
}
