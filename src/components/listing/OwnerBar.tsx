"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@/generated/prisma/enums";
import { deleteListing, setListingStatus } from "@/app/actions/listings";
import { useToast } from "@/components/Toast";
import { announceStamp } from "./LiveStamp";

export function OwnerBar({ id, status, base }: { id: string; status: ListingStatus; base: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(status);
  const [confirming, setConfirming] = useState(false);

  const change = (next: ListingStatus) => {
    const previous = current;
    setCurrent(next);
    start(async () => {
      const result = await setListingStatus(id, next);
      if (!result.ok) {
        setCurrent(previous);
        toast(result.error, undefined, { type: "error" });
        return;
      }
      announceStamp(next);
      toast(
        next === "sold" ? "Marked as sold" : next === "reserved" ? "Marked as reserved" : "Back on the market",
        next === "sold" ? "Nice one. It's off the feed now." : undefined,
        { action: "Undo", onAction: () => change(previous) },
      );
      router.refresh();
    });
  };

  const remove = () => {
    start(async () => {
      const result = await deleteListing(id);
      if (!result.ok) {
        toast(result.error, undefined, { type: "error" });
        return;
      }
      toast("Listing deleted");
      router.replace("/account");
    });
  };

  return (
    <div className="owner-bar" aria-busy={pending}>
      <p>This is your listing</p>
      {current === "active" ? (
        <>
          <button className="btn btn--outline btn--sm" type="button" disabled={pending} onClick={() => change("reserved")}>
            Mark reserved
          </button>
          <button className="btn btn--primary btn--sm" type="button" disabled={pending} onClick={() => change("sold")}>
            Mark sold
          </button>
        </>
      ) : current === "reserved" ? (
        <>
          <button className="btn btn--outline btn--sm" type="button" disabled={pending} onClick={() => change("active")}>
            Available again
          </button>
          <button className="btn btn--primary btn--sm" type="button" disabled={pending} onClick={() => change("sold")}>
            Mark sold
          </button>
        </>
      ) : (
        <button className="btn btn--outline btn--sm" type="button" disabled={pending} onClick={() => change("active")} style={{ gridColumn: "1 / -1" }}>
          Not sold after all? Relist it
        </button>
      )}
      <Link className="btn btn--ghost btn--sm" href={`${base}/l/${id}/edit`}>
        Edit details
      </Link>
      {confirming ? (
        <button className="btn btn--danger btn--sm" type="button" disabled={pending} onClick={remove}>
          Tap again to delete
        </button>
      ) : (
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
    </div>
  );
}
