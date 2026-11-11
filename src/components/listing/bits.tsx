import Image from "next/image";
import type { Category, ListingStatus, PriceType } from "@/generated/prisma/enums";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { categoryOf } from "@/lib/catalog";
import { formatInr } from "@/lib/format";
import { photoUrl } from "@/lib/photos";

type PriceProps = {
  priceType: PriceType;
  price: number | null;
  originalPrice?: number | null;
  showOriginal?: boolean;
};

export function Price({ priceType, price, originalPrice, showOriginal = true }: PriceProps) {
  const original =
    showOriginal && originalPrice ? (
      <s>
        <span className="sr-only">Costs </span>
        {formatInr(originalPrice)} new
      </s>
    ) : null;
  if (priceType === "free") {
    return (
      <div className="price">
        <b className="free">Free</b>
        {original}
      </div>
    );
  }
  if (priceType === "exchange") {
    return (
      <div className="price">
        <b className="swap">Exchange</b>
      </div>
    );
  }
  return (
    <div className="price">
      <b>{formatInr(price ?? 0)}</b>
      {original}
    </div>
  );
}

type BadgeProps = { status: ListingStatus; priceType: PriceType; category: Category; isNew?: boolean };

/** One badge per card, most important first: Sold > Reserved > Free > Exchange > Book > Just listed. */
export function StatusBadge({ status, priceType, category, isNew }: BadgeProps) {
  if (status === "sold") return <span className="badge badge--sold">Sold</span>;
  if (status === "reserved") return <span className="badge badge--reserved">Reserved</span>;
  if (priceType === "free") return <span className="badge badge--free">Free</span>;
  if (priceType === "exchange") {
    return (
      <span className="badge badge--exchange">
        <Icon name="swap" />
        Exchange
      </span>
    );
  }
  if (category === "books") {
    return (
      <span className="badge badge--book">
        <Icon name="book" />
        Book
      </span>
    );
  }
  if (isNew) return <span className="badge badge--new">Just listed</span>;
  return <span />;
}

export function DemoBadge() {
  return (
    <span className="badge badge--demo" title="Example listing added to show how the app works">
      Demo
    </span>
  );
}

export function Stamp({ status, large }: { status: ListingStatus; large?: boolean }) {
  if (status === "active") return null;
  return (
    <span className={`stamp stamp--${status}${large ? " stamp--lg" : ""}`} aria-hidden="true">
      {status === "sold" ? "Sold" : "Reserved"}
    </span>
  );
}

type VisualProps = {
  category: Category;
  photo: { path: string; width: number; height: number } | null;
  size: "thumb" | "full";
  alt: string;
  priority?: boolean;
  sizes?: string;
};

/** A listing's photo, or its category illustration when the seller didn't add one. */
export function ListingVisual({ category, photo, size, alt, priority, sizes }: VisualProps) {
  if (!photo) return <Illustration name={categoryOf(category).art} />;
  return (
    <Image
      src={photoUrl(photo.path, size)}
      alt={alt}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      priority={priority}
      unoptimized
      draggable={false}
    />
  );
}
