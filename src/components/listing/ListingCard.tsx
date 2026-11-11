import Link from "next/link";
import { Icon } from "@/components/Icon";
import { conditionLabel, tintFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";
import type { ListingCardData } from "@/lib/listings/queries";
import { ChatButton } from "./ChatButton";
import { DemoBadge, ListingVisual, Price, Stamp, StatusBadge } from "./bits";

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** The kit's product card, adapted: inset image, one badge, price with "₹X new", meta row, chat CTA. */
export function ListingCard({
  listing,
  viewerId,
  now,
}: {
  listing: ListingCardData;
  viewerId: string | null;
  now: number;
}) {
  const isNew = now - new Date(listing.createdAt).getTime() < SIX_HOURS;
  return (
    <article className={`card card--${listing.status}`}>
      <div className="card__img" style={{ background: `var(--${tintFor(listing.id)})` }}>
        <ListingVisual
          category={listing.category}
          photo={listing.cover}
          size="thumb"
          alt=""
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        <div className="card__badges">
          <StatusBadge status={listing.status} priceType={listing.priceType} category={listing.category} isNew={isNew} />
          {listing.isDemo ? <DemoBadge /> : null}
        </div>
        <Stamp status={listing.status} />
      </div>
      <div className="card__body">
        <h3 className="card__title">
          <Link href={`/l/${listing.id}`}>{listing.title}</Link>
        </h3>
        <Price priceType={listing.priceType} price={listing.price} originalPrice={listing.originalPrice} />
        <div className="meta">
          <span>{conditionLabel(listing.condition)}</span>
          <span>
            <Icon name="pin" />
            {listing.pickupSpot}
          </span>
          <span>{timeAgo(listing.createdAt, new Date(now))}</span>
        </div>
      </div>
      <div className="card__cta">
        {listing.sellerId === viewerId ? (
          <Link className="btn btn--outline btn--sm" href={`/l/${listing.id}`}>
            Your listing
          </Link>
        ) : (
          <ChatButton listingId={listing.id} status={listing.status} signedIn={viewerId !== null} />
        )}
      </div>
    </article>
  );
}

export function SkeletonCard() {
  return (
    <div className="card card--sk" aria-hidden="true">
      <div className="card__img sk" />
      <div className="card__body">
        <div className="sk sk-line" style={{ width: "90%" }} />
        <div className="sk sk-line" style={{ width: "60%" }} />
        <div className="sk sk-line" style={{ width: "40%", height: 18 }} />
      </div>
      <div className="sk" style={{ height: 40, borderRadius: 999, marginTop: 8 }} />
    </div>
  );
}
