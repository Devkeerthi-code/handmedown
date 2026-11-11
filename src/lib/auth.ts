import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { CollegeRole } from "@/generated/prisma/enums";
import { createSupabaseServer } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import type { Viewer } from "@/lib/db/rls";

/** Who is making this request, from a verified JWT (getClaims checks the signature). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
});

export type Me = Viewer & {
  displayName: string;
  /** The college whose domain matches your confirmed email. Null = not a member anywhere yet. */
  collegeId: string | null;
  collegeSlug: string | null;
  collegeName: string | null;
  /** Your staff role in your own college, if any. */
  collegeRole: CollegeRole | null;
  /** Member of some college and not banned. */
  verified: boolean;
  /** Platform admin (ADMIN_EMAILS). */
  isAdmin: boolean;
  banned: boolean;
};

export const getMe = cache(async (): Promise<Me | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const profile = await db.profile.findUnique({
    where: { id: viewer.id },
    select: {
      displayName: true,
      collegeId: true,
      isAdmin: true,
      bannedAt: true,
      college: { select: { slug: true, name: true } },
      collegeRoles: { select: { collegeId: true, role: true } },
    },
  });
  if (!profile) return null;
  const role = profile.collegeRoles.find((r) => r.collegeId === profile.collegeId)?.role ?? null;
  return {
    ...viewer,
    displayName: profile.displayName,
    collegeId: profile.collegeId,
    collegeSlug: profile.college?.slug ?? null,
    collegeName: profile.college?.name ?? null,
    collegeRole: role,
    verified: profile.collegeId !== null && profile.bannedAt === null,
    isAdmin: profile.isAdmin,
    banned: profile.bannedAt !== null,
  };
});

export async function requireMe(nextPath: string): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return me;
}

/** Can this person post, chat or set alerts in this college? */
export function isMemberOf(me: Me | null, collegeId: string) {
  return Boolean(me && me.verified && me.collegeId === collegeId);
}

export function isStaffOf(me: Me | null, collegeId: string) {
  return Boolean(me && isMemberOf(me, collegeId) && me.collegeRole !== null);
}

export function isCollegeAdminOf(me: Me | null, collegeId: string) {
  return Boolean(me && isMemberOf(me, collegeId) && me.collegeRole === "admin");
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
