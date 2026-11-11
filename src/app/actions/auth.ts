"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe, safeNext } from "@/lib/auth";
import { collegeForDomain } from "@/lib/college";
import { emailDomain, isPublicEmailDomain } from "@/lib/public-domains";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { createSupabaseServer } from "@/lib/supabase/server";
import { displayNameSchema, emailSchema, fieldErrors, passwordSchema } from "@/lib/validation";

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Supabase auth errors -> plain language. */
function authMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first. Check your inbox (and spam) for the link.";
  if (/already registered|already been registered/i.test(message)) return "There's already an account with this email. Sign in instead.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a few minutes and try again.";
  if (/weak|pwned|password/i.test(message)) return "Pick a stronger password that isn't used elsewhere.";
  return "Couldn't do that right now. Please try again.";
}

const signUpSchema = z.object({ displayName: displayNameSchema, email: emailSchema, password: passwordSchema });

export async function signUp(input: z.input<typeof signUpSchema>): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error));
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/account`,
    },
  });
  if (error) return fail(authMessage(error.message));
  return ok({ needsConfirmation: !data.session });
}

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") });

export async function signIn(input: z.input<typeof signInSchema>, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", fieldErrors(parsed.error));
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authMessage(error.message));
  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { email: parsed.error.issues[0].message });
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/account/password`,
  });
  // Same answer either way so this can't be used to find out who has an account.
  if (error && /rate limit/i.test(error.message)) return fail(authMessage(error.message));
  return ok(null);
}

export async function updatePassword(password: string): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { password: parsed.error.issues[0].message });
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return fail(authMessage(error.message));
  return ok(null);
}

/**
 * Joining or transferring = switching the account to a college email. Supabase sends a confirmation
 * link; once it's clicked, the database trigger makes you a member of the college that owns that domain.
 */
export async function verifyCollegeEmail(
  email: string,
): Promise<ActionResult<{ collegeName: string | null; domain: string }>> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { email: parsed.error.issues[0].message });
  const domain = emailDomain(parsed.data);
  if (isPublicEmailDomain(domain)) {
    const msg = "That's a personal email. Use the one your college gave you.";
    return fail(msg, { email: msg });
  }
  const owner = await collegeForDomain(domain);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/account` },
  );
  if (error) return fail(authMessage(error.message));
  return ok({ collegeName: owner?.status === "active" ? owner.college.name : null, domain });
}

export async function updateDisplayName(name: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { displayName: parsed.error.issues[0].message });
  try {
    await withRls(me, (tx) => tx.profile.updateMany({ where: { id: me.id }, data: { displayName: parsed.data } }));
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    logError("updateDisplayName", error);
    return fail(friendlyError(error));
  }
}
