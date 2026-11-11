import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isMemberOf, requireMe } from "@/lib/auth";
import { getCollegeBySlug } from "@/lib/college";
import { getInbox } from "@/lib/chat/queries";
import { requestTime } from "@/lib/format";
import { Inbox } from "@/components/chat/Inbox";
import { Illustration } from "@/components/Illustration";
import { MemberGate } from "@/components/college/MemberGate";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage({ params }: PageProps<"/c/[slug]/chats">) {
  const college = await getCollegeBySlug((await params).slug);
  if (!college) notFound();
  const base = `/c/${college.slug}`;
  const me = await requireMe(`${base}/chats`);
  if (!isMemberOf(me, college.id)) {
    return (
      <div className="container page">
        <MemberGate me={me} college={college} action="chat" />
      </div>
    );
  }
  const items = await getInbox(me);
  const now = requestTime();
  return (
    <div className="container page">
      <div className="chats chats--list">
        <Inbox items={items} now={now} base={base} />
        <section className="thread" aria-hidden="true">
          <div className="thread-empty">
            <div className="state__art">
              <Illustration name="box" />
            </div>
            <p>Pick a chat on the left. Each one is pinned to its listing.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
