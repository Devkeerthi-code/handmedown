import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { getListingForEdit } from "@/lib/listings/queries";
import { ListingForm, type ListingFormValues } from "@/components/sell/ListingForm";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/l/[id]/edit">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const me = await requireMe(`/l/${id}/edit`);
  const listing = await getListingForEdit(me, id);
  if (!listing) notFound();

  const values: ListingFormValues = {
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition,
    priceType: listing.priceType,
    price: listing.price?.toString() ?? "",
    originalPrice: listing.originalPrice?.toString() ?? "",
    exchangeFor: listing.exchangeFor ?? "",
    pickupSpot: listing.pickupSpot,
    isbn: listing.isbn ?? "",
    bookSemester: listing.bookSemester?.toString() ?? "",
    bookSubject: listing.bookSubject ?? "",
    bookAuthor: listing.bookAuthor ?? "",
  };

  return (
    <div className="container page">
      <div className="sell">
        <div className="page__head">
          <h1>Edit listing</h1>
          <p>Changes show up for buyers straight away.</p>
        </div>
      </div>
      <ListingForm
        userId={me.id}
        listingId={listing.id}
        initial={values}
        initialPhotos={listing.photos.map((p) => ({
          key: p.id,
          path: p.storagePath,
          width: p.width,
          height: p.height,
          status: "done" as const,
        }))}
      />
    </div>
  );
}
