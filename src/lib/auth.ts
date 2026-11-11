import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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
  verified: boolean;
  isAdmin: boolean;
  banned: boolean;
};

export const getMe = cache(async (): Promise<Me | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const profile = await db.profile.findUnique({
    where: { id: viewer.id },
    select: { displayName: true, verifiedAt: true, isAdmin: true, bannedAt: true },
  });
  if (!profile) return null;
  return {
    ...viewer,
    displayName: profile.displayName,
    verified: profile.verifiedAt !== null && profile.bannedAt === null,
    isAdmin: profile.isAdmin,
    banned: profile.bannedAt !== null,
  };
});

export async function requireMe(nextPath: string): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return me;
}

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
