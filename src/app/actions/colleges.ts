"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMe, isCollegeAdminOf } from "@/lib/auth";
import { collegeLogoUrl, getCollegeById } from "@/lib/college";
import { db } from "@/lib/db/client";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  collegeBrandingSchema,
  createCollegeSchema,
  domainSchema,
  emailSchema,
  fieldErrors,
  type CollegeBrandingInput,
  type CreateCollegeInput,
} from "@/lib/validation";

const uuid = z.string().uuid();

function collegeError(error: unknown, fallbackField?: string): ActionResult<never> {
  const msg = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  if (/PUBLIC_DOMAIN/.test(msg)) return fail("Public email providers like Gmail can't identify a college.", { domain: "Use a college email domain" });
  if (/DOMAIN_TAKEN|college_domains_pkey/.test(msg)) return fail("That domain already belongs to a college on HandMeDown.", { domain: "Already in use" });
  if (/EMAIL_NOT_VERIFIED/.test(msg)) return fail("Confirm your email first, then try again.");
  if (/colleges_slug_key/.test(msg)) return fail("That web address is taken. Try another.", { slug: "Already taken" });
  logError("colleges", error);
  const friendly = friendlyError(error);
  return fail(friendly, fallbackField ? { [fallbackField]: friendly } : undefined);
}

/** Creates a college for the caller's confirmed email domain. All checks also run inside app.create_college(). */
export async function createCollege(input: CreateCollegeInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const parsed = createCollegeSchema.safeParse(input);
  if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
  const v = parsed.data;
  try {
    const [row] = await withRls(me, (tx) => tx.$queryRaw<{ id: string }[]>`
      SELECT app.create_college(${v.name}, ${v.shortName}, ${v.slug}, ${v.accent},
        ${v.pickupSpots}::text[], ${v.categories}::app."Category"[]) AS id`);
    revalidatePath("/", "layout");
    return ok({ id: row.id, slug: v.slug });
  } catch (error) {
    return collegeError(error);
  }
}

const LOGO_TYPES: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

/** Uploads with the admin's own session, so the storage policy (college admins only) is what allows it. */
export async function uploadCollegeLogo(collegeId: string, form: FormData): Promise<ActionResult<{ logoUrl: string }>> {
  const me = await getMe();
  if (!me || !uuid.safeParse(collegeId).success) return fail("Sign in first.");
  if (!isCollegeAdminOf(me, collegeId) && !me.isAdmin) return fail("Only this college's admins can change its logo.");
  const file = form.get("logo");
  if (!(file instanceof Blob)) return fail("Choose an image first.");
  const ext = LOGO_TYPES[file.type];
  if (!ext) return fail("Logos must be PNG, JPEG or WebP.");
  if (file.size === 0 || file.size > 1024 * 1024) return fail("Logos must be under 1 MB.");

  const path = `${collegeId}/${randomUUID()}.${ext}`;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.storage.from("college-logos").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    logError("uploadCollegeLogo", error);
    return fail("Couldn't upload the logo. Try a smaller image.");
  }
  try {
    const previous = await db.college.findUnique({ where: { id: collegeId }, select: { logoPath: true } });
    await withRls(me, (tx) => tx.college.updateMany({ where: { id: collegeId }, data: { logoPath: path } }));
    if (previous?.logoPath) await supabase.storage.from("college-logos").remove([previous.logoPath]);
    revalidatePath("/", "layout");
    return ok({ logoUrl: collegeLogoUrl(path)! });
  } catch (error) {
    return collegeError(error);
  }
}

export async function updateCollegeBranding(collegeId: string, input: CollegeBrandingInput): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(collegeId).success) return fail("Sign in first.");
  const parsed = collegeBrandingSchema.safeParse(input);
  if (!parsed.success) return fail("Some details need fixing.", fieldErrors(parsed.error));
  try {
    const { count } = await withRls(me, (tx) => tx.college.updateMany({ where: { id: collegeId }, data: parsed.data }));
    if (count === 0) return fail("Only this college's admins can change its settings.");
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return collegeError(error);
  }
}

/** Extra domains start pending until the platform admin approves them (enforced by a trigger). */
export async function addCollegeDomain(collegeId: string, domain: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(collegeId).success) return fail("Sign in first.");
  const parsed = domainSchema.safeParse(domain);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { domain: parsed.error.issues[0].message });
  try {
    await withRls(me, (tx) => tx.collegeDomain.create({ data: { domain: parsed.data, collegeId }, select: { domain: true } }));
    revalidatePath("/c/[slug]/admin", "page");
    revalidatePath("/admin");
    return ok(null);
  } catch (error) {
    return collegeError(error, "domain");
  }
}

export async function removeCollegeDomain(domain: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  try {
    const { count } = await withRls(me, (tx) => tx.collegeDomain.deleteMany({ where: { domain } }));
    if (count === 0) return fail("Only pending domains can be removed by college admins.");
    revalidatePath("/c/[slug]/admin", "page");
    revalidatePath("/admin");
    return ok(null);
  } catch (error) {
    return collegeError(error);
  }
}

/** College admins promote existing members of THEIR college (looked up by their verified email). */
export async function addCollegeStaff(collegeId: string, email: string, role: "moderator" | "admin"): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(collegeId).success) return fail("Sign in first.");
  if (!isCollegeAdminOf(me, collegeId) && !me.isAdmin) return fail("Only this college's admins can add moderators.");
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return fail(parsed.error.issues[0].message, { email: parsed.error.issues[0].message });
  if (role !== "moderator" && role !== "admin") return fail("Unknown role.");
  const [member] = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM app.profiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = ${parsed.data} AND p.college_id = ${collegeId}::uuid AND p.banned_at IS NULL`;
  if (!member) {
    const msg = "No verified member of this college uses that email. They need to join first.";
    return fail(msg, { email: msg });
  }
  try {
    await withRls(me, (tx) => tx.$executeRaw`
      INSERT INTO app.college_roles (college_id, user_id, role, granted_by)
      VALUES (${collegeId}::uuid, ${member.id}::uuid, ${role}::app."CollegeRole", ${me.id}::uuid)
      ON CONFLICT (college_id, user_id) DO NOTHING`);
    revalidatePath("/c/[slug]/admin", "page");
    return ok(null);
  } catch (error) {
    return collegeError(error, "email");
  }
}

export async function removeCollegeStaff(collegeId: string, userId: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me || !uuid.safeParse(collegeId).success || !uuid.safeParse(userId).success) return fail("Sign in first.");
  try {
    const { count } = await withRls(me, (tx) => tx.collegeRoleAssignment.deleteMany({ where: { collegeId, userId } }));
    if (count === 0) return fail("You can't remove that role (you can't remove yourself).");
    revalidatePath("/c/[slug]/admin", "page");
    return ok(null);
  } catch (error) {
    return collegeError(error);
  }
}

/** Platform admin only: suspended colleges stay readable but nothing new can be posted, sent or reported. */
export async function setCollegeStatus(collegeId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const me = await getMe();
  if (!me?.isAdmin) return fail("Only the platform admin can do that.");
  if (!uuid.safeParse(collegeId).success || !["active", "suspended"].includes(status)) return fail("Unknown college.");
  try {
    await withRls(me, (tx) => tx.college.updateMany({ where: { id: collegeId }, data: { status } }));
    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return collegeError(error);
  }
}

export async function reviewDomain(domain: string, approve: boolean): Promise<ActionResult> {
  const me = await getMe();
  if (!me?.isAdmin) return fail("Only the platform admin can do that.");
  try {
    await withRls(me, (tx) =>
      approve
        ? tx.collegeDomain.updateMany({ where: { domain, status: "pending" }, data: { status: "active" } })
        : tx.collegeDomain.deleteMany({ where: { domain, status: "pending" } }),
    );
    revalidatePath("/admin");
    return ok(null);
  } catch (error) {
    return collegeError(error);
  }
}

export async function collegeName(collegeId: string) {
  return (await getCollegeById(collegeId))?.name ?? null;
}
