import { Prisma } from "@/generated/prisma/client";
import { looksLikeIsbn, normalizeIsbn } from "@/lib/isbn";
import type { Cursor } from "@/lib/cursor";
import type { SearchFilters, Sort } from "@/lib/validation";

export const PAGE_SIZE = 12;

/** Free sorts as ₹0; Exchange has no price, so it goes last in either direction. */
const SORT: Record<Sort, { key: Prisma.Sql; dir: "ASC" | "DESC" }> = {
  newest: { key: Prisma.sql`l.created_at`, dir: "DESC" },
  price_asc: {
    key: Prisma.sql`(CASE l.price_type WHEN 'free' THEN 0 WHEN 'fixed' THEN l.price ELSE 2147483647 END)`,
    dir: "ASC",
  },
  price_desc: {
    key: Prisma.sql`(CASE l.price_type WHEN 'free' THEN 0 WHEN 'fixed' THEN l.price ELSE -1 END)`,
    dir: "DESC",
  },
};

/** The WHERE clause shared by the page query and the result count. */
export function buildWhere(filters: SearchFilters, viewerId: string | null): Prisma.Sql {
  const where: Prisma.Sql[] = [Prisma.sql`NOT l.is_hidden`, Prisma.sql`l.status <> 'sold'`];

  if (filters.category) where.push(Prisma.sql`l.category = ${filters.category}::app."Category"`);
  if (filters.condition) where.push(Prisma.sql`l.condition = ${filters.condition}::app."Condition"`);

  if (filters.free && filters.exchange) where.push(Prisma.sql`l.price_type IN ('free', 'exchange')`);
  else if (filters.free) where.push(Prisma.sql`l.price_type = 'free'`);
  else if (filters.exchange) where.push(Prisma.sql`l.price_type = 'exchange'`);

  if (filters.min !== undefined && filters.min > 0) {
    where.push(Prisma.sql`(l.price_type = 'fixed' AND l.price >= ${filters.min})`);
  }
  if (filters.max !== undefined) {
    where.push(Prisma.sql`(l.price_type = 'free' OR (l.price_type = 'fixed' AND l.price <= ${filters.max}))`);
  }

  if (filters.q) {
    const isbn = looksLikeIsbn(filters.q) ? normalizeIsbn(filters.q) : null;
    where.push(
      isbn
        ? Prisma.sql`l.isbn = ${isbn}`
        : Prisma.sql`l.search_vector @@ app.prefix_tsquery(${filters.q})`,
    );
  }

  if (viewerId) {
    // Hide sellers you've blocked. (RLS only lets you read your own block rows.)
    where.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM app.blocks b WHERE b.blocker_id = ${viewerId}::uuid AND b.blocked_id = l.seller_id
    )`);
  }
  return Prisma.join(where, " AND ");
}

function cursorClause(sort: Sort, cursor: Cursor): Prisma.Sql {
  const { key, dir } = SORT[sort];
  const op = Prisma.raw(dir === "DESC" ? "<" : ">");
  const value = sort === "newest" ? Prisma.sql`${String(cursor.v)}::timestamptz` : Prisma.sql`${Number(cursor.v)}::int`;
  return Prisma.sql`(${key}, l.id) ${op} (${value}, ${cursor.id}::uuid)`;
}

/** One page of listing cards, newest/price ordered, using keyset pagination. Fetches limit+1 to know if there's more. */
export function buildSearchQuery(
  filters: SearchFilters,
  cursor: Cursor | null,
  viewerId: string | null,
  limit = PAGE_SIZE,
): Prisma.Sql {
  const { key, dir } = SORT[filters.sort];
  const direction = Prisma.raw(dir);
  const where = cursor
    ? Prisma.sql`${buildWhere(filters, viewerId)} AND ${cursorClause(filters.sort, cursor)}`
    : buildWhere(filters, viewerId);
  // created_at goes out as text so the cursor keeps Postgres' microsecond precision.
  return Prisma.sql`
    SELECT l.id, l.title, l.category::text AS category, l.condition::text AS condition,
           l.price_type::text AS price_type, l.price, l.original_price, l.exchange_for,
           l.pickup_spot, l.status::text AS status, l.is_demo, l.created_at, l.isbn, l.seller_id,
           cover.storage_path AS cover_path, cover.width AS cover_width, cover.height AS cover_height,
           (${key})::text AS sort_value
    FROM app.listings l
    LEFT JOIN LATERAL (
      SELECT ph.storage_path, ph.width, ph.height FROM app.listing_photos ph
      WHERE ph.listing_id = l.id ORDER BY ph.position LIMIT 1
    ) cover ON true
    WHERE ${where}
    ORDER BY ${key} ${direction}, l.id ${direction}
    LIMIT ${limit + 1}`;
}

export function buildCountQuery(filters: SearchFilters, viewerId: string | null): Prisma.Sql {
  return Prisma.sql`SELECT count(*)::int AS n FROM app.listings l WHERE ${buildWhere(filters, viewerId)}`;
}
