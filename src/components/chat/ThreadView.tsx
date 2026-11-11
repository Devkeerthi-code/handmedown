"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser, markRead, sendMessage, unblockUser } from "@/app/actions/chat";
import { Icon } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { ReportDialog } from "@/components/ReportDialog";
import { useToast } from "@/components/Toast";
import { Price } from "@/components/listing/bits";
import type { ChatMessage, Thread } from "@/lib/chat/queries";
import { categoryOf, tintFor } from "@/lib/catalog";
import { clockTime, initials } from "@/lib/format";
import { containsPhoneNumber } from "@/lib/phone";
import { photoUrl } from "@/lib/photos";
import { PRESETS, Spring } from "@/lib/physics";
import { supabaseBrowser } from "@/lib/supabase/browser";

type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

const QUICK_REPLIES = ["Is this still available?", "Can we meet today?", "What's the lowest you'd take?"];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** New bubbles pop in on a spring from the corner they belong to. */
function popIn(el: HTMLElement | null) {
  if (!el) return;
  new Spring(0.85, PRESETS.chip, (v) => {
    el.style.transform = v === 1 ? "" : `scale(${v})`;
  }).set(1);
}

function mergeById(a: LocalMessage[], b: LocalMessage[]) {
  const map = new Map<string, LocalMessage>();
  [...a, ...b].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
}

export function ThreadView({ thread, meId, base }: { thread: Thread; meId: string; base: string }) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<LocalMessage[]>(thread.messages);
  const [seenServer, setSeenServer] = useState(thread.messages);
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState(thread.blocked);
  const [iBlocked, setIBlocked] = useState(thread.iBlocked);
  const [, startBlock] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const lastPopped = useRef<string | null>(null);

  // A refresh brings fresh server messages: merge, don't throw away optimistic ones.
  if (seenServer !== thread.messages) {
    setSeenServer(thread.messages);
    setMessages((prev) => mergeById(prev, thread.messages));
  }

  const readSoon = useRef(0);
  const markSeen = useCallback(() => {
    window.clearTimeout(readSoon.current);
    readSoon.current = window.setTimeout(async () => {
      if (document.visibilityState !== "visible") return;
      const r = await markRead(thread.id);
      if (r.ok) router.refresh();
    }, 400);
  }, [thread.id, router]);

  useEffect(() => {
    markSeen();
    const onVisible = () => document.visibilityState === "visible" && markSeen();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markSeen]);

  // Live messages over a private channel only the two of you can join (RLS on realtime.messages).
  useEffect(() => {
    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`conversation:${thread.id}`, { config: { private: true } })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const m = payload as ChatMessage;
          setMessages((prev) => mergeById(prev, [m]));
          if (m.senderId !== meId) markSeen();
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [thread.id, meId, markSeen]);

  // Keep the newest message in view and give it a little pop.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    const last = messages[messages.length - 1];
    if (last && last.id !== lastPopped.current) {
      if (lastPopped.current !== null) popIn(list.querySelector<HTMLElement>(`[data-id="${CSS.escape(last.id)}"]`));
      lastPopped.current = last.id;
    }
  }, [messages]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || blocked) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: LocalMessage = { id: tempId, senderId: meId, body, createdAt: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    const result = await sendMessage(thread.id, body);
    if (result.ok) {
      setMessages((prev) => mergeById(prev.filter((m) => m.id !== tempId), [result.data]));
      router.refresh(); // the inbox beside the thread is server-rendered
    } else {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
      toast(result.error, undefined, { type: "error" });
    }
  };

  const retry = (m: LocalMessage) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    void send(m.body);
  };

  const toggleBlock = () => {
    const wasBlocked = iBlocked;
    startBlock(async () => {
      const result = wasBlocked ? await unblockUser(thread.other.id) : await blockUser(thread.other.id);
      if (!result.ok) {
        toast(result.error, undefined, { type: "error" });
        return;
      }
      setIBlocked(!wasBlocked);
      setBlocked(!wasBlocked);
      toast(wasBlocked ? `Unblocked ${thread.other.name}` : `Blocked ${thread.other.name}`, wasBlocked ? undefined : "They can't message you and you won't see their listings.");
      (document.activeElement as HTMLElement | null)?.closest("details")?.removeAttribute("open");
      router.refresh();
    });
  };

  const phoneWarning = containsPhoneNumber(draft);
  const myMessages = messages.some((m) => m.senderId === meId);
  const l = thread.listing;

  return (
    <section className="thread" aria-label={`Chat with ${thread.other.name}`}>
      <div className="thread__head">
        <Link className="back" href={`${base}/chats`} aria-label="Back to all chats">
          <Icon name="left" />
        </Link>
        <span className="avatar avatar--sm" aria-hidden="true">
          {initials(thread.other.name)}
        </span>
        <div className="thread__who">
          <b>
            {thread.other.name}
            {thread.other.verified ? (
              <span className="badge badge--verified">
                <Icon name="verified" />
                Verified
              </span>
            ) : (
              <span className="not-verified">Not verified</span>
            )}
          </b>
          <small>{thread.iAmSeller ? "Interested in your listing" : "Seller"}</small>
        </div>
        <details className="menu">
          <summary aria-label="More options">
            <Icon name="more" />
          </summary>
          <div className="menu__list">
            <button type="button" className={iBlocked ? undefined : "danger"} onClick={toggleBlock}>
              <Icon name="ban" />
              {iBlocked ? `Unblock ${thread.other.name}` : `Block ${thread.other.name}`}
            </button>
            <ReportDialog reportedUserId={thread.other.id} label={`Report ${thread.other.name}`} trigger="menu" signedIn />
          </div>
        </details>
      </div>

      {l ? (
        <Link className="pinned" href={`${base}/l/${l.id}`}>
          <span className="pinned__img" style={{ background: `var(--${tintFor(l.id)})` }}>
            {l.coverPath ? (
              <Image src={photoUrl(l.coverPath, "thumb")} alt="" width={52} height={52} unoptimized />
            ) : (
              <Illustration name={categoryOf(l.category).art} />
            )}
          </span>
          <span style={{ minWidth: 0 }}>
            <b>{l.title}</b>
            <small>
              {l.status === "sold" ? "Sold" : l.status === "reserved" ? "Reserved" : "Available"} · {l.pickupSpot}
              {l.isDemo ? " · demo" : ""}
            </small>
          </span>
          <Price priceType={l.priceType} price={l.price} showOriginal={false} />
        </Link>
      ) : (
        <p className="notice notice--warn" style={{ margin: "12px 16px 0" }}>
          <Icon name="eyeOff" />
          This listing was removed or is under review.
        </p>
      )}

      <div className="msgs" ref={listRef} role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          <p className="day">Say hi. Ask about condition, or suggest a time to meet.</p>
        ) : null}
        {messages.map((m, i) => {
          const day = dayLabel(m.createdAt);
          const showDay = i === 0 || day !== dayLabel(messages[i - 1].createdAt);
          const mine = m.senderId === meId;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {showDay ? <span className="day">{day}</span> : null}
              <div data-id={m.id} className={`bubble ${mine ? "bubble--me" : "bubble--them"}`} style={m.pending ? { opacity: 0.7 } : undefined}>
                {m.body}
                <time dateTime={m.createdAt}>
                  {m.failed ? (
                    <button type="button" className="link" onClick={() => retry(m)} style={{ color: "inherit" }}>
                      Not sent. Tap to retry
                    </button>
                  ) : m.pending ? (
                    "Sending…"
                  ) : (
                    clockTime(m.createdAt)
                  )}
                </time>
              </div>
            </div>
          );
        })}
      </div>

      {blocked ? (
        <div className="blocked" role="status">
          <span>
            <Icon name="ban" className="inline" />{" "}
            {iBlocked ? `You blocked ${thread.other.name}. Unblock to keep chatting.` : "You can't reply in this chat."}
          </span>
          {iBlocked ? (
            <button className="btn btn--outline btn--sm" type="button" onClick={toggleBlock}>
              Unblock
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {!myMessages && !thread.iAmSeller ? (
            <div className="quick">
              <div className="chips chips--scroll" role="group" aria-label="Quick replies">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} className="chip" type="button" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {phoneWarning ? (
            <p className="privacy" role="status" style={{ color: "var(--accent-ink)" }}>
              <Icon name="info" />
              That looks like a phone number. You don&apos;t need to share it. Chat and meet here.
            </p>
          ) : (
            <p className="privacy">
              <Icon name="lock" />
              Only you and {thread.other.name} can read this chat.
            </p>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="composer">
              Message {thread.other.name}
            </label>
            <input
              id="composer"
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message"
              maxLength={2000}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button className="send" type="submit" disabled={!draft.trim()} aria-label="Send message">
              <Icon name="send" />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
