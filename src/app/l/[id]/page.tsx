import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { categoryOf, conditionLabel, tintFor } from "@/lib/catalog";
import { formatIsbn } from "@/lib/isbn";
import { formatInr, initials, timeAgo } from "@/lib/format";
import { getListingDetail } from "@/lib/listings/queries";
import { Icon } from "@/components/Icon";
import { Gallery } from "@/components/listing/Gallery";
import { LiveStamp } from "@/components/listing/LiveStamp";
import { OwnerBar } from "@/components/listing/OwnerBar";
import { ChatButton } from "@/components/listing/ChatButton";
import { DemoBadge, Price, StatusBadge } from "@/components/listing/bits";
import { ReportDialog } from "@/components/ReportDialog";

const idSchema = z.string().uuid();

async function load(id: string) {
  if (!idSchema.safeParse(id).success) notFound();
  const viewer = await getViewer();
  const listing = await getListingDetail(viewer, id);
  if (!listing) notFound();
  return { viewer, listing };
}

export async function generateMetadata({ params }: PageProps<"/l/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return { title: "Listing not found" };
  const listing = await getListingDetail(await getViewer(), id).catch(() => null);
  if (!listing) return { title: "Listing not found" };
  const price = listing.priceType === "fixed" ? formatInr(listing.price ?? 0) : listing.priceType === "free" ? "Free" : "Exchange";
  return { title: listing.title, description: `${price} · ${conditionLabel(listing.condition)} · pick up at ${listing.pickupSpot}` };
}

export default async function ListingPage({ params }: PageProps<"/l/[id]">) {
  const { id } = await params;
  const { viewer, listing } = await load(id);
  const signedIn = viewer !== null;
  const cat = categoryOf(listing.category);

  return (
    <div className="container page has-cta-bar">
      <Link className="back" href="/#listings">
        <Icon name="left" />
        Back to listings
      </Link>

      {listing.isHidden ? (
        <p className="notice notice--warn" role="status" style={{ marginBottom: 16 }}>
          <Icon name="eyeOff" />
          This listing is hidden while an admin reviews a report. Only you{listing.isOwner ? "" : " and admins"} can see it.
        </p>
      ) : null}

      <div className="detail">
        <div>
          <Gallery
            photos={listing.photos}
            category={listing.category}
            title={listing.title}
            tint={tintFor(listing.id)}
            overlay={
              <>
                <div className="gallery__badges">
                  <StatusBadge status={listing.status} priceType={listing.priceType} category={listing.category} />
                  {listing.isDemo ? <DemoBadge /> : null}
                </div>
                <LiveStamp initial={listing.status} />
              </>
            }
          />
        </div>

        <div className="detail__info">
          <div>
            <p className="section__sub" style={{ marginTop: 0 }}>
              {cat.label} · listed {timeAgo(listing.createdAt)}
            </p>
            <h1 className="detail__title">{listing.title}</h1>
          </div>
          <Price priceType={listing.priceType} price={listing.price} originalPrice={listing.originalPrice} />
          {listing.priceType === "exchange" && listing.exchangeFor ? (
            <p className="desc">
              <b>Will swap for:</b> {listing.exchangeFor}
            </p>
          ) : null}

          <div className="facts">
            <div className="fact">
              <small>
                <Icon name="tag" />
                Condition
              </small>
              <b>{conditionLabel(listing.condition)}</b>
            </div>
            <div className="fact">
              <small>
                <Icon name="pin" />
                Pick up at
              </small>
              <b>{listing.pickupSpot}</b>
            </div>
          </div>

          {listing.category === "books" && (listing.isbn || listing.bookSemester || listing.bookSubject || listing.bookAuthor) ? (
            <section className="bookblock" aria-label="Book details">
              <h3>
                <Icon name="book" />
                Book details
              </h3>
              <dl>
                {listing.bookSubject ? (
                  <div>
                    <dt>Subject</dt>
                    <dd>{listing.bookSubject}</dd>
                  </div>
                ) : null}
                {listing.bookSemester ? (
                  <div>
                    <dt>Semester</dt>
                    <dd>Sem {listing.bookSemester}</dd>
                  </div>
                ) : null}
                {listing.bookAuthor ? (
                  <div>
                    <dt>Author</dt>
                    <dd>{listing.bookAuthor}</dd>
                  </div>
                ) : null}
                {listing.isbn ? (
                  <div>
                    <dt>ISBN</dt>
                    <dd>{formatIsbn(listing.isbn)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {listing.description ? <p className="desc" style={{ whiteSpace: "pre-line" }}>{listing.description}</p> : null}

          <div className="seller">
            <span className="avatar" aria-hidden="true">
              {initials(listing.seller.displayName)}
            </span>
            <div>
              <b>
                {listing.seller.displayName}
                {listing.seller.verifiedAt ? (
                  <span className="badge badge--verified">
                    <Icon name="verified" />
                    Verified student
                  </span>
                ) : (
                  <span className="not-verified">Not verified</span>
                )}
              </b>
              <small>
                {listing.sellerHandedDown > 0
                  ? `Has handed down ${listing.sellerHandedDown} item${listing.sellerHandedDown === 1 ? "" : "s"}`
                  : "New seller"}
                {listing.seller.isDemo ? " · demo account" : ""}
              </small>
            </div>
          </div>

          {listing.isOwner ? (
            <OwnerBar id={listing.id} status={listing.status} />
          ) : (
            <>
              <p className="safety">
                <Icon name="shield" />
                Meet in a public campus spot and check the item before paying. Never pay in advance.
              </p>
              {listing.blocked ? (
                <p className="notice notice--error">
                  <Icon name="ban" />
                  You can&apos;t chat with this seller.
                </p>
              ) : (
                <div className="detail__actions">
                  <ChatButton
                    listingId={listing.id}
                    status={listing.status}
                    signedIn={signedIn}
                    existingConversationId={listing.conversationId}
                    className="btn--lg btn--block"
                  />
                </div>
              )}
              <div>
                <ReportDialog listingId={listing.id} label="Report this listing" trigger="link" signedIn={signedIn} afterReport="home" />
              </div>
            </>
          )}
        </div>
      </div>

      {!listing.isOwner && !listing.blocked ? (
        <div className="cta-bar">
          <Price priceType={listing.priceType} price={listing.price} showOriginal={false} />
          <ChatButton
            listingId={listing.id}
            status={listing.status}
            signedIn={signedIn}
            existingConversationId={listing.conversationId}
            className="btn--block"
          />
        </div>
      ) : null}
    </div>
  );
}
