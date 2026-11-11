"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/actions/chat";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import type { ListingStatus } from "@/generated/prisma/enums";

type Props = {
  listingId: string;
  status: ListingStatus;
  signedIn: boolean;
  isOwner?: boolean;
  existingConversationId?: string | null;
  className?: string;
  base: string;
};

/** "Chat with seller": opens (or reopens) the in-app chat. Never shows a phone number. */
export function ChatButton({ listingId, status, signedIn, isOwner, existingConversationId, className = "btn--sm", base }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  if (isOwner) return null;
  if (status === "sold" && !existingConversationId) {
    return (
      <button className={`btn btn--outline ${className}`} type="button" disabled>
        Sold, handed down
      </button>
    );
  }

  const open = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`${base}/l/${listingId}`)}`);
      return;
    }
    if (existingConversationId) {
      router.push(`${base}/chats/${existingConversationId}`);
      return;
    }
    start(async () => {
      const result = await startConversation(listingId);
      if (result.ok) router.push(`${base}/chats/${result.data.id}`);
      else toast(result.error, undefined, { type: "error" });
    });
  };

  const reserved = status === "reserved";
  return (
    <button
      className={`btn ${reserved ? "btn--outline" : "btn--primary"} ${className}`}
      type="button"
      onClick={open}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <span className="spinner" aria-hidden="true" /> : reserved ? null : <Icon name="chat" />}
      {existingConversationId ? "Open chat" : reserved ? "Ask to be next" : "Chat with seller"}
    </button>
  );
}
