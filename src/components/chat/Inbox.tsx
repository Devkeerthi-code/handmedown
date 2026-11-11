import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { categoryOf, tintFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import type { InboxItem } from "@/lib/chat/queries";

export function Inbox({ items, activeId, now }: { items: InboxItem[]; activeId?: string; now: number }) {
  const unread = items.reduce((n, i) => n + i.unread, 0);
  return (
    <section className="inbox" aria-labelledby="inboxTitle">
      <div className="inbox__head">
        <h1 id="inboxTitle">Chats</h1>
        <p className="section__sub" style={{ marginTop: 0 }}>
          {items.length === 0
            ? "Your conversations will show up here."
            : unread
              ? `${unread} unread message${unread === 1 ? "" : "s"}`
              : "You're all caught up."}
        </p>
      </div>
      {items.length === 0 ? (
        <div className="thread-empty">
          <div className="state__art">
            <Illustration name="box" />
          </div>
          <p>No chats yet. Find something you like and tap “Chat with seller”.</p>
          <Link className="btn btn--primary btn--sm" href="/#listings">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.id} className={c.unread ? "inbox__unread" : undefined}>
              <Link href={`/chats/${c.id}`} aria-current={c.id === activeId ? "page" : undefined}>
                <span className="inbox__thumb" style={{ background: `var(--${tintFor(c.listingId)})` }}>
                  {c.coverPath ? (
                    <Image src={photoUrl(c.coverPath, "thumb")} alt="" width={44} height={44} unoptimized />
                  ) : (
                    <Illustration name={c.listingCategory ? categoryOf(c.listingCategory).art : "box"} />
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="inbox__name">
                    {c.otherName}
                    {c.otherVerified ? <Icon name="verified" /> : null}
                  </span>
                  <span className="inbox__item" style={{ display: "block" }}>
                    {c.listingTitle ?? "Listing no longer available"}
                  </span>
                  <span className="inbox__last" style={{ display: "block" }}>
                    {c.lastBody ? `${c.lastFromMe ? "You: " : ""}${c.lastBody}` : "No messages yet"}
                  </span>
                </span>
                <span className="inbox__side">
                  <span className="inbox__time">{timeAgo(c.lastMessageAt, new Date(now))}</span>
                  {c.unread ? (
                    <span className="count" aria-label={`${c.unread} unread`}>
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
