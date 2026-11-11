import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMe } from "@/lib/auth";
import { getCollegeBySlug } from "@/lib/college";
import { getInbox, getThread } from "@/lib/chat/queries";
import { requestTime } from "@/lib/format";
import { Inbox } from "@/components/chat/Inbox";
import { ThreadView } from "@/components/chat/ThreadView";

export const metadata: Metadata = { title: "Chat" };

export default async function ThreadPage({ params }: PageProps<"/c/[slug]/chats/[id]">) {
  const { slug, id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const college = await getCollegeBySlug(slug);
  if (!college) notFound();
  const base = `/c/${college.slug}`;
  const me = await requireMe(`${base}/chats/${id}`);
  const [thread, items] = await Promise.all([getThread(me, id), getInbox(me)]);
  // Not a participant, or not a member of this chat's college: RLS returns nothing, so we 404 and leak nothing.
  if (!thread || thread.collegeId !== college.id) notFound();
  const now = requestTime();
  return (
    <div className="container page">
      <div className="chats chats--thread">
        <Inbox items={items} activeId={id} now={now} base={base} />
        <ThreadView key={thread.id} thread={thread} meId={me.id} base={base} />
      </div>
    </div>
  );
}
