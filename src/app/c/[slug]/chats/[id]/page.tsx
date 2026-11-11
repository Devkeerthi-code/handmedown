import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { getInbox, getThread } from "@/lib/chat/queries";
import { Inbox } from "@/components/chat/Inbox";
import { requestTime } from "@/lib/format";
import { ThreadView } from "@/components/chat/ThreadView";

export const metadata: Metadata = { title: "Chat" };

export default async function ThreadPage({ params }: PageProps<"/chats/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const me = await requireMe(`/chats/${id}`);
  const [thread, items] = await Promise.all([getThread(me, id), getInbox(me)]);
  // Not a participant? RLS returns nothing, and we show 404 rather than "forbidden" to leak nothing.
  if (!thread) notFound();
  const now = requestTime();
  return (
    <div className="container page">
      <div className="chats chats--thread">
        <Inbox items={items} activeId={id} now={now} />
        <ThreadView key={thread.id} thread={thread} meId={me.id} />
      </div>
    </div>
  );
}
