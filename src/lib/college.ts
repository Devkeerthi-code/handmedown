import "server-only";
import { cache } from "react";
import type { Category, CollegeStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";

export type CollegeInfo = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  accent: string;
  pickupSpots: string[];
  categories: Category[];
  status: CollegeStatus;
  isDemo: boolean;
};

export function collegeLogoUrl(path: string | null) {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/college-logos/${path}` : null;
}

type CollegeRow = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoPath: string | null;
  accent: string;
  pickupSpots: string[];
  categories: Category[];
  status: CollegeStatus;
  isDemo: boolean;
};

function toInfo(c: CollegeRow): CollegeInfo {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    slug: c.slug,
    logoUrl: collegeLogoUrl(c.logoPath),
    accent: c.accent,
    pickupSpots: c.pickupSpots,
    categories: c.categories,
    status: c.status,
    isDemo: c.isDemo,
  };
}

const SELECT = {
  id: true, name: true, shortName: true, slug: true, logoPath: true, accent: true,
  pickupSpots: true, categories: true, status: true, isDemo: true,
} as const;

/** Colleges are public (it's a directory), so these reads don't need RLS. Cached per request. */
export const getCollegeBySlug = cache(async (slug: string): Promise<CollegeInfo | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const c = await db.college.findUnique({ where: { slug }, select: SELECT });
  return c ? toInfo(c) : null;
});

export const getCollegeById = cache(async (id: string): Promise<CollegeInfo | null> => {
  const c = await db.college.findUnique({ where: { id }, select: SELECT });
  return c ? toInfo(c) : null;
});

export type DirectoryEntry = {
  slug: string;
  name: string;
  shortName: string;
  accent: string;
  logoUrl: string | null;
  listingCount: number;
  isDemo: boolean;
  status: "active" | "suspended";
};

/** Active colleges for the home page directory, real colleges first, then demos. */
export async function getDirectory(): Promise<DirectoryEntry[]> {
  const [colleges, counts] = await Promise.all([
    db.college.findMany({ where: { status: "active" }, orderBy: [{ isDemo: "asc" }, { name: "asc" }], select: SELECT, take: 500 }),
    db.listing.groupBy({ by: ["collegeId"], where: { isHidden: false, status: { not: "sold" } }, _count: { _all: true } }),
  ]);
  const byCollege = new Map(counts.map((c) => [c.collegeId, c._count._all]));
  return colleges.map((c) => ({
    slug: c.slug,
    name: c.name,
    shortName: c.shortName,
    accent: c.accent,
    logoUrl: collegeLogoUrl(c.logoPath),
    listingCount: byCollege.get(c.id) ?? 0,
    isDemo: c.isDemo,
    status: c.status,
  }));
}

/** Which college (if any) already owns this email domain, for "Your college is already here". */
export async function collegeForDomain(domain: string) {
  const d = domain.toLowerCase();
  const rows = await db.collegeDomain.findMany({
    where: { OR: [{ domain: d }, ...suffixes(d).map((s) => ({ domain: s }))] },
    select: { domain: true, status: true, college: { select: { slug: true, name: true } } },
  });
  rows.sort((a, b) => b.domain.length - a.domain.length);
  return rows[0] ?? null;
}

/** cse.iitm.ac.in -> [iitm.ac.in, ac.in]: parents a college domain could match through. */
function suffixes(domain: string) {
  const parts = domain.split(".");
  return parts.slice(1, -1).map((_, i) => parts.slice(i + 1).join("."));
}

export function collegePath(slug: string, rest = "") {
  return `/c/${slug}${rest}`;
}
