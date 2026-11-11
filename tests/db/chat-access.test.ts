import { describe, expect, it } from "vitest";
import { as, asOwner, attempt, createConversation, createListing, createUser, sql, withTestDatabase } from "./helpers";

withTestDatabase();

async function setup() {
  const seller = await createUser({ name: "Seller" });
  const buyer = await createUser({ name: "Buyer" });
  const stranger = await createUser({ name: "Stranger" });
  const listingId = await createListing(seller);
  const convId = await createConversation(listingId, buyer, seller);
  await sql("INSERT INTO app.messages (conversation_id, sender_id, body) VALUES ($1, $2, 'Is it available?')", [convId, buyer.id]);
  return { seller, buyer, stranger, listingId, convId };
}

const send = (convId: string, senderId: string, body = "hello") =>
  attempt("INSERT INTO app.messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id", [convId, senderId, body]);

describe("only the two participants can read a chat", () => {
  it("buyer and seller see the conversation and its messages", async () => {
    const { seller, buyer, convId } = await setup();
    for (const user of [buyer, seller]) {
      await as(user);
      expect(await sql("SELECT id FROM app.conversations WHERE id = $1", [convId])).toHaveLength(1);
      expect(await sql("SELECT id FROM app.messages WHERE conversation_id = $1", [convId])).toHaveLength(1);
    }
  });

  it("a non-participant sees nothing, not even that it exists", async () => {
    const { stranger, convId } = await setup();
    await as(stranger);
    expect(await sql("SELECT id FROM app.conversations WHERE id = $1", [convId])).toHaveLength(0);
    expect(await sql("SELECT body FROM app.messages WHERE conversation_id = $1", [convId])).toHaveLength(0);
    expect(await sql("SELECT count(*)::int AS n FROM app.messages")).toEqual([{ n: 0 }]);
  });

  it("anon can't read any messages", async () => {
    const { convId } = await setup();
    await as(null);
    const r = await attempt("SELECT body FROM app.messages WHERE conversation_id = $1", [convId]);
    expect(r.ok).toBe(false); // no grant at all for anon
  });
});

describe("sending messages", () => {
  it("participants can send as themselves", async () => {
    const { seller, convId } = await setup();
    await as(seller);
    expect((await send(convId, seller.id)).ok).toBe(true);
  });

  it("a non-participant can't post into someone else's chat", async () => {
    const { stranger, convId } = await setup();
    await as(stranger);
    expect((await send(convId, stranger.id)).ok).toBe(false);
  });

  it("you can't send a message pretending to be the other person", async () => {
    const { buyer, seller, convId } = await setup();
    await as(buyer);
    expect((await send(convId, seller.id)).ok).toBe(false);
  });

  it("blocked users can't message, in either direction", async () => {
    const { buyer, seller, convId } = await setup();
    await as(seller);
    expect((await attempt("INSERT INTO app.blocks (blocker_id, blocked_id) VALUES ($1, $2)", [seller.id, buyer.id])).ok).toBe(true);
    await as(buyer);
    expect((await send(convId, buyer.id)).ok).toBe(false);
    await as(seller);
    expect((await send(convId, seller.id)).ok).toBe(false);
  });

  it("blocked users can't open a new chat either", async () => {
    const seller = await createUser();
    const buyer = await createUser();
    const listingId = await createListing(seller);
    await sql("INSERT INTO app.blocks (blocker_id, blocked_id) VALUES ($1, $2)", [seller.id, buyer.id]);
    await as(buyer);
    const r = await attempt("INSERT INTO app.conversations (listing_id, buyer_id, seller_id) VALUES ($1, $2, $3)", [listingId, buyer.id, seller.id]);
    expect(r.ok).toBe(false);
  });

  it("empty messages are rejected by the database", async () => {
    const { buyer, convId } = await setup();
    await as(buyer);
    expect((await send(convId, buyer.id, "   ")).ok).toBe(false);
  });

  it("a new message bumps the conversation and counts as read for the sender", async () => {
    const { buyer, seller, convId } = await setup();
    await as(seller);
    await send(convId, seller.id, "Yes, still here");
    await asOwner();
    const [reads] = await sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM app.conversation_reads WHERE conversation_id = $1 AND user_id = $2",
      [convId, seller.id],
    );
    expect(reads.n).toBe(1);
    // Unread for the buyer: the seller's message only.
    await as(buyer);
    const [unread] = await sql<{ n: number }>(
      `SELECT count(*)::int AS n FROM app.messages m
       LEFT JOIN app.conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = $2
       WHERE m.conversation_id = $1 AND m.sender_id <> $2 AND m.created_at > coalesce(r.last_read_at, '-infinity')`,
      [convId, buyer.id],
    );
    expect(unread.n).toBe(1);
  });
});

describe("Realtime channel authorization", () => {
  it("only participants may join conversation:<id>, and only you may join user:<you>", async () => {
    const { buyer, stranger, convId } = await setup();
    await as(buyer);
    const [own] = await sql<{ conv: boolean; me: boolean; other: boolean; junk: boolean }>(
      "SELECT app.can_join_topic($1) AS conv, app.can_join_topic($2) AS me, app.can_join_topic($3) AS other, app.can_join_topic('conversation:not-a-uuid') AS junk",
      [`conversation:${convId}`, `user:${buyer.id}`, `user:${stranger.id}`],
    );
    expect(own).toEqual({ conv: true, me: true, other: false, junk: false });
    await as(stranger);
    const [theirs] = await sql<{ conv: boolean }>("SELECT app.can_join_topic($1) AS conv", [`conversation:${convId}`]);
    expect(theirs.conv).toBe(false);
  });
});
