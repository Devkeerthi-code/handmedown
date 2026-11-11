"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { ListingStatus } from "@/generated/prisma/enums";
import { getMe } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { withRls } from "@/lib/db/rls";
import { fail, friendlyError, logError, ok, type ActionResult } from "@/lib/errors";
import { thumbPathOf, validateStoredPhoto } from "@/lib/images/rules";
import { notifyAlertsForListing } from "@/lib/push";
import { PHOTO_BUCKET } from "@/lib/photos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fieldErrors, listingInputSchema, type ListingData, type ListingInput } from "@/lib/validation";

type StoredObject = { name: string; mimetype: string | null; size: number | null };

/** Every photo (and its thumbnail) must really be in Storage, in the user's folder, small and the right type. */
async function verifyPhotos(photos: ListingData["photos"], userId: string): Promise<string | null> {
  if (photos.length === 0) return null;
  const paths = photos.map((p) => p.path);
  if (new Set(paths).size !== paths.length) return "The same photo was added twice.";
  const wanted = [...paths, ...paths.map(thumbPathOf)];
  const objects = await db.$queryRaw<StoredObject[]>`
    SELECT name, metadata->>'mimetype' AS mimetype, (metadata->>'size')::int AS size
    FROM storage.objects
    WHERE bucket_id = ${PHOTO_BUCKET} AND name = ANY(${wanted}::text[])`;
  const byName = new Map(objects.map((o) => [o.name, o]));
  for (const path of paths) {
    const full = byName.get(path);
    if (!full || !byName.has(thumbPathOf(path))) return "A photo didn't finish uploading. Remove it and add it again.";
    const check = validateStoredPhoto({ path, mimetype: full.mimetype, size: full.size }, userId);
    if (!check.ok) return check.reason;
  }
  return null;
}

function listingColumns(data: ListingData) {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    condition: data.condition,
    priceType: data.priceType,
    price: data.price,
    originalPrice: data.originalPrice,
    exchangeFor: data.exchangeFor,
    pickupSpot: data.pickupSpot,
    isbn: data.isbn,
    bookSemester: data.bookSemester,
    bookSubject: data.bookSubject,
    bookAuthor: data.bookAuthor,
  };
}

async function removeStoredPhotos(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin()
    .storage.from(PHOTO_BUCKET)
    .remove([...paths, ...paths.map(thumbPathOf)]);
  if (error) logError("storage-cleanup", error);
}

async function validate(input: ListingInput) {
  const me = await getMe();
  if (!me) return { error: fail("Sign in to post a listing.") };
  if (!me.verified) return { error: fail("Verify your college email before posting.") };
  const parsed = listingInputSchema.safeParse(input);
  if (!parsed.success) return { error: fail("Some details need fixing.", fieldErrors(parsed.error)) };
  const photoProblem = await verifyPhotos(parsed.data.photos, me.id);
  if (photoProblem) return { error: fail(photoProblem, { photos: photoProblem }) };
  return { me, data: parsed.data };
}

export async function createListing(input: ListingInput): Promise<ActionResult<{ id: string }>> {
  const checked = await validate(input);
  if ("error" in checked) return checked.error!;
  const { me, data } = checked;
  try {
    const id = await withRls(me, async (tx) => {
      const listing = await tx.listing.create({
        data: { ...listingColumns(data), sellerId: me.id },
        select: { id: true },
      });
      if (data.photos.length > 0) {
        await tx.listingPhoto.createMany({
          data: data.photos.map((p, position) => ({
            listingId: listing.id,
            storagePath: p.path,
            width: p.width,
            height: p.height,
            position,
          })),
        });
      }
      return listing.id;
    });
    after(() => notifyAlertsForListing(id).catch((e) => logError("alerts", e)));
    revalidatePath("/");
    return ok({ id });
  } catch (error) {
    logError("createListing", error);
    return fail(friendlyError(error));
  }
}

export async function updateListing(id: string, input: ListingInput): Promise<ActionResult<{ id: string }>> {
  const checked = await validate(input);
  if ("error" in checked) return checked.error!;
  const { me, data } = checked;
  try {
    const removed = await withRls(me, async (tx) => {
      const existing = await tx.listingPhoto.findMany({
        where: { listingId: id, listing: { sellerId: me.id } },
        select: { storagePath: true },
      });
      const updated = await tx.listing.updateMany({
        where: { id, sellerId: me.id },
        data: listingColumns(data),
      });
      if (updated.count === 0) throw new Error("permission denied: not the owner");
      await tx.listingPhoto.deleteMany({ where: { listingId: id } });
      if (data.photos.length > 0) {
        await tx.listingPhoto.createMany({
          data: data.photos.map((p, position) => ({
            listingId: id,
            storagePath: p.path,
            width: p.width,
            height: p.height,
            position,
          })),
        });
      }
      const kept = new Set(data.photos.map((p) => p.path));
      return existing.map((p) => p.storagePath).filter((p) => !kept.has(p));
    });
    after(() => removeStoredPhotos(removed));
    revalidatePath(`/l/${id}`);
    revalidatePath("/");
    return ok({ id });
  } catch (error) {
    logError("updateListing", error);
    return fail(friendlyError(error));
  }
}

export async function setListingStatus(id: string, status: ListingStatus): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  if (!["active", "reserved", "sold"].includes(status)) return fail("Unknown status.");
  try {
    const { count } = await withRls(me, (tx) =>
      tx.listing.updateMany({ where: { id, sellerId: me.id }, data: { status } }),
    );
    if (count === 0) return fail("Only the seller can change this listing.");
    revalidatePath(`/l/${id}`);
    revalidatePath("/");
    return ok(null);
  } catch (error) {
    logError("setListingStatus", error);
    return fail(friendlyError(error));
  }
}

export async function deleteListing(id: string): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  try {
    const paths = await withRls(me, async (tx) => {
      const photos = await tx.listingPhoto.findMany({
        where: { listingId: id, listing: { sellerId: me.id } },
        select: { storagePath: true },
      });
      const { count } = await tx.listing.deleteMany({ where: { id, sellerId: me.id } });
      if (count === 0) throw new Error("permission denied: not the owner");
      return photos.map((p) => p.storagePath);
    });
    after(() => removeStoredPhotos(paths));
    revalidatePath("/");
    return ok(null);
  } catch (error) {
    logError("deleteListing", error);
    return fail(friendlyError(error));
  }
}

/** Uploaded but never attached to a listing (user changed their mind): tidy up straight away. */
export async function discardUploads(paths: string[]): Promise<ActionResult> {
  const me = await getMe();
  if (!me) return fail("Sign in first.");
  const own = paths.filter((p) => typeof p === "string" && p.startsWith(`${me.id}/`)).slice(0, 10);
  const used = await db.listingPhoto.findMany({ where: { storagePath: { in: own } }, select: { storagePath: true } });
  const usedSet = new Set(used.map((u) => u.storagePath));
  await removeStoredPhotos(own.filter((p) => !usedSet.has(p)));
  return ok(null);
}
