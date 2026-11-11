import type { Metadata } from "next";
import { requireMe } from "@/lib/auth";
import { getInbox } from "@/lib/chat/queries";
import { Inbox } from "@/components/chat/Inbox";
import { requestTime } from "@/lib/format";
import { Illustration } from "@/components/Illustration";

export const metadata: Metadata = { title: "Chats" };

export default async function ChatsPage() {
  const me = await requireMe("/chats");
  const items = await getInbox(me);
  const now = requestTime();
  return (
    <div className="container page">
      <div className="chats chats--list">
        <Inbox items={items} now={now} />
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
