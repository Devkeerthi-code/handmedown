import { describe, expect, it } from "vitest";
import {
  COLLEGE_A,
  COLLEGE_B,
  as,
  asOwner,
  attempt,
  createConversation,
  createListing,
  createUser,
  sql,
  withTestDatabase,
} from "./helpers";

withTestDatabase();

/** A complete little world in college A: a seller, a buyer, a listing, a chat, an alert and a report. */
async function collegeAWorld() {
  const seller = await createUser({ college: "a", name: "A seller" });
  const buyer = await createUser({ college: "a", name: "A buyer" });
  const listing = await createListing(seller, { title: "A cycle", category: "cycles" });
  const conv = await createConversation(listing, buyer, seller);
  await sql("INSERT INTO app.messages (conversation_id, sender_id, body) VALUES ($1, $2, 'Still there?')", [conv, buyer.id]);
  await sql("INSERT INTO app.wishlist_alerts (user_id, college_id, query) VALUES ($1, $2, 'lamp')", [buyer.id, COLLEGE_A]);
  const [report] = await sql<{ id: string }>(
    "INSERT INTO app.reports (reporter_id, college_id, listing_id, reason) VALUES ($1, $2, $3, 'spam') RETURNING id",
    [buyer.id, COLLEGE_A, listing],
  );
  await sql("UPDATE app.listings SET is_hidden = false WHERE id = $1", [listing]); // keep it visible for the tests
  return { seller, buyer, listing, conv, report: report.id };
}

describe("membership comes from the confirmed email domain", () => {
  it("puts users in the college that owns their domain (subdomains count), and nowhere otherwise", async () => {
    const a = await createUser({ college: "a" });
    const b = await createUser({ college: "b" });
    const sub = await createUser({ domain: "cse.test.edu.in" });
    const personal = await createUser({ college: false });
    const unconfirmed = await createUser({ college: "a", confirmed: false });
    expect([a.collegeId, b.collegeId, sub.collegeId, personal.collegeId, unconfirmed.collegeId]).toEqual([
      COLLEGE_A,
      COLLEGE_B,
      COLLEGE_A,
      null,
      null,
    ]);
  });

  it("transferring (changing to another college's email) moves you and drops your old staff roles", async () => {
    const mod = await createUser({ college: "a", role: "moderator" });
    await sql("UPDATE auth.users SET email = $2 WHERE id = $1", [mod.id, `${mod.id.slice(0, 8)}@other-test.ac.in`]);
    const [p] = await sql<{ college_id: string }>("SELECT college_id FROM app.profiles WHERE id = $1", [mod.id]);
    expect(p.college_id).toBe(COLLEGE_B);
    expect(await sql("SELECT 1 FROM app.college_roles WHERE user_id = $1", [mod.id])).toHaveLength(0);
  });
});

describe("cross-college reads all come back empty", () => {
  it("a member of college B sees none of A's chats, messages, alerts or reports", async () => {
    const w = await collegeAWorld();
    const outsider = await createUser({ college: "b" });
    await as(outsider);
    expect(await sql("SELECT id FROM app.conversations WHERE id = $1", [w.conv])).toHaveLength(0);
    expect(await sql("SELECT id FROM app.messages WHERE conversation_id = $1", [w.conv])).toHaveLength(0);
    expect(await sql("SELECT id FROM app.wishlist_alerts WHERE college_id = $1", [COLLEGE_A])).toHaveLength(0);
    expect(await sql("SELECT id FROM app.reports WHERE id = $1", [w.report])).toHaveLength(0);
    expect(await sql("SELECT 1 FROM app.college_roles WHERE college_id = $1", [COLLEGE_A])).toHaveLength(0);
  });

  it("…but anyone can browse A's public listings", async () => {
    const w = await collegeAWorld();
    for (const who of [await createUser({ college: "b" }), null]) {
      await as(who);
      expect(await sql("SELECT id FROM app.listings WHERE id = $1", [w.listing])).toHaveLength(1);
    }
  });

  it("a former participant who transferred away loses access to the old college's chat", async () => {
    const w = await collegeAWorld();
    await sql("UPDATE auth.users SET email = $2 WHERE id = $1", [w.buyer.id, `${w.buyer.id.slice(0, 8)}@other-test.ac.in`]);
    await as({ ...w.buyer, collegeId: COLLEGE_B });
    expect(await sql("SELECT id FROM app.messages WHERE conversation_id = $1", [w.conv])).toHaveLength(0);
  });
});

describe("cross-college writes are all refused", () => {
  it("a member of B can't post, chat, message, alert or report in A", async () => {
    const w = await collegeAWorld();
    const outsider = await createUser({ college: "b" });
    await as(outsider);
    expect(
      (await attempt(
        `INSERT INTO app.listings (seller_id, college_id, title, category, condition, price_type, price, pickup_spot)
         VALUES ($1, $2, 'Sneaky', 'other', 'good', 'fixed', 100, 'Central Library')`,
        [outsider.id, COLLEGE_A],
      )).ok,
    ).toBe(false);
    expect(
      (await attempt("INSERT INTO app.conversations (listing_id, buyer_id, seller_id, college_id) VALUES ($1, $2, $3, $4)", [
        w.listing, outsider.id, w.seller.id, COLLEGE_A,
      ])).ok,
    ).toBe(false);
    expect((await attempt("INSERT INTO app.messages (conversation_id, sender_id, body) VALUES ($1, $2, 'hi')", [w.conv, outsider.id])).ok).toBe(false);
    expect((await attempt("INSERT INTO app.wishlist_alerts (user_id, college_id, query) VALUES ($1, $2, 'x')", [outsider.id, COLLEGE_A])).ok).toBe(false);
    expect(
      (await attempt("INSERT INTO app.reports (reporter_id, college_id, listing_id, reason) VALUES ($1, $2, $3, 'spam')", [
        outsider.id, COLLEGE_A, w.listing,
      ])).ok,
    ).toBe(false);
    expect((await attempt("UPDATE app.listings SET title = 'pwned' WHERE id = $1", [w.listing])).rowCount).toBe(0);
  });

  it("someone with no college at all can't post anywhere", async () => {
    const personal = await createUser({ college: false });
    await as(personal);
    const r = await attempt(
      `INSERT INTO app.listings (seller_id, college_id, title, category, condition, price_type, price, pickup_spot)
       VALUES ($1, $2, 'Hello', 'other', 'good', 'fixed', 100, 'Central Library')`,
      [personal.id, COLLEGE_A],
    );
    expect(r.ok).toBe(false);
  });
});

describe("the database itself refuses cross-college rows", () => {
  it("a conversation can't point at a listing from another college, even as the owner role", async () => {
    const w = await collegeAWorld();
    const buyerB = await createUser({ college: "b" });
    const r = await attempt("INSERT INTO app.conversations (listing_id, buyer_id, seller_id, college_id) VALUES ($1, $2, $3, $4)", [
      w.listing, buyerB.id, w.seller.id, COLLEGE_B,
    ]);
    expect(r.ok).toBe(false); // composite foreign key (listing_id, college_id)
  });

  it("buyer and seller must both be members of the conversation's college", async () => {
    const w = await collegeAWorld();
    const buyerB = await createUser({ college: "b" });
    const r = await attempt("INSERT INTO app.conversations (listing_id, buyer_id, seller_id, college_id) VALUES ($1, $2, $3, $4)", [
      w.listing, buyerB.id, w.seller.id, COLLEGE_A,
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/CROSS_COLLEGE/);
  });

  it("listings can't move college and must use the college's categories and meeting spots", async () => {
    const seller = await createUser({ college: "a" });
    const id = await createListing(seller);
    expect((await attempt("UPDATE app.listings SET college_id = $2 WHERE id = $1", [id, COLLEGE_B])).ok).toBe(false);
    expect((await attempt("UPDATE app.listings SET pickup_spot = 'North Gate' WHERE id = $1", [id])).error).toMatch(/UNKNOWN_PICKUP_SPOT/);
    await sql("UPDATE app.colleges SET categories = ARRAY['books']::app.\"Category\"[] WHERE id = $1", [COLLEGE_A]);
    expect((await attempt("UPDATE app.listings SET category = 'cycles' WHERE id = $1", [id])).error).toMatch(/CATEGORY_NOT_ENABLED/);
  });
});

describe("storage, realtime and alerts respect college boundaries", () => {
  it("uploads must go under your own college and user folder", async () => {
    const a = await createUser({ college: "a" });
    await as(a);
    const put = (path: string) =>
      attempt("INSERT INTO storage.objects (bucket_id, name, owner_id, metadata) VALUES ('listing-photos', $1, $2, '{}'::jsonb)", [path, a.id]);
    expect((await put(`${COLLEGE_A}/${a.id}/${crypto.randomUUID()}.webp`)).ok).toBe(true);
    expect((await put(`${COLLEGE_B}/${a.id}/${crypto.randomUUID()}.webp`)).ok).toBe(false);
    expect((await put(`${a.id}/${crypto.randomUUID()}.webp`)).ok).toBe(false);
  });

  it("only that college's admins can upload its logo", async () => {
    const admin = await createUser({ college: "a", role: "admin" });
    const member = await createUser({ college: "a" });
    const put = (owner: string, college: string) =>
      attempt("INSERT INTO storage.objects (bucket_id, name, owner_id, metadata) VALUES ('college-logos', $1, $2, '{}'::jsonb)", [
        `${college}/${crypto.randomUUID()}.webp`, owner,
      ]);
    await as(admin);
    expect((await put(admin.id, COLLEGE_A)).ok).toBe(true);
    expect((await put(admin.id, COLLEGE_B)).ok).toBe(false);
    await as(member);
    expect((await put(member.id, COLLEGE_A)).ok).toBe(false);
  });

  it("a member of B can't join A's chat channel", async () => {
    const w = await collegeAWorld();
    await as(await createUser({ college: "b" }));
    const [r] = await sql<{ ok: boolean }>("SELECT app.can_join_topic($1) AS ok", [`conversation:${w.conv}`]);
    expect(r.ok).toBe(false);
  });

  it("an alert in college B never fires for a listing in college A", async () => {
    const seller = await createUser({ college: "a" });
    const watcherB = await createUser({ college: "b" });
    const watcherA = await createUser({ college: "a" });
    await sql("UPDATE app.wishlist_alerts SET active = false");
    await sql("INSERT INTO app.wishlist_alerts (user_id, college_id, query) VALUES ($1, $2, 'kettle'), ($3, $4, 'kettle')", [
      watcherB.id, COLLEGE_B, watcherA.id, COLLEGE_A,
    ]);
    const id = await createListing(seller, { title: "Electric kettle" });
    const rows = await sql<{ user_id: string }>("SELECT user_id FROM app.match_alerts($1)", [id]);
    expect(rows.map((r) => r.user_id)).toEqual([watcherA.id]);
  });
});

describe("suspended colleges are read-only", () => {
  it("members can still read, but can't post, message, alert or report", async () => {
    const w = await collegeAWorld();
    await sql("UPDATE app.colleges SET status = 'suspended' WHERE id = $1", [COLLEGE_A]);
    await as(w.buyer);
    expect(await sql("SELECT id FROM app.messages WHERE conversation_id = $1", [w.conv])).toHaveLength(1);
    expect((await attempt("INSERT INTO app.messages (conversation_id, sender_id, body) VALUES ($1, $2, 'hi')", [w.conv, w.buyer.id])).ok).toBe(false);
    expect((await attempt("INSERT INTO app.wishlist_alerts (user_id, college_id, query) VALUES ($1, $2, 'x')", [w.buyer.id, COLLEGE_A])).ok).toBe(false);
    expect(
      (await attempt(
        `INSERT INTO app.listings (seller_id, college_id, title, category, condition, price_type, price, pickup_spot)
         VALUES ($1, $2, 'New', 'other', 'good', 'fixed', 100, 'Central Library')`,
        [w.buyer.id, COLLEGE_A],
      )).ok,
    ).toBe(false);
    await as(w.seller);
    expect((await attempt("UPDATE app.listings SET status = 'sold' WHERE id = $1", [w.listing])).rowCount).toBe(0);
  });
});

describe("roles", () => {
  it("moderators handle their own college's reports only", async () => {
    const w = await collegeAWorld();
    const modA = await createUser({ college: "a", role: "moderator" });
    const modB = await createUser({ college: "b", role: "moderator" });
    await sql("UPDATE app.listings SET is_hidden = true WHERE id = $1", [w.listing]);

    await as(modB);
    expect(await sql("SELECT id FROM app.reports WHERE id = $1", [w.report])).toHaveLength(0);
    expect((await attempt("UPDATE app.listings SET is_hidden = false WHERE id = $1", [w.listing])).rowCount).toBe(0);

    await as(modA);
    expect(await sql("SELECT id FROM app.reports WHERE id = $1", [w.report])).toHaveLength(1);
    expect((await attempt("UPDATE app.reports SET status = 'dismissed' WHERE id = $1", [w.report])).rowCount).toBe(1);
    expect((await attempt("UPDATE app.listings SET is_hidden = false WHERE id = $1", [w.listing])).rowCount).toBe(1);
  });

  it("moderators can't change branding; college admins can, but can't suspend or change the slug", async () => {
    const mod = await createUser({ college: "a", role: "moderator" });
    const admin = await createUser({ college: "a", role: "admin" });
    await as(mod);
    expect((await attempt("UPDATE app.colleges SET accent = '#000000' WHERE id = $1", [COLLEGE_A])).rowCount).toBe(0);
    await as(admin);
    expect((await attempt("UPDATE app.colleges SET accent = '#123456', name = 'Renamed College' WHERE id = $1", [COLLEGE_A])).rowCount).toBe(1);
    expect((await attempt("UPDATE app.colleges SET status = 'suspended' WHERE id = $1", [COLLEGE_A])).ok).toBe(false);
    expect((await attempt("UPDATE app.colleges SET slug = 'stolen' WHERE id = $1", [COLLEGE_A])).ok).toBe(false);
    expect((await attempt("UPDATE app.colleges SET accent = '#123456' WHERE id = $1", [COLLEGE_B])).rowCount).toBe(0);
  });

  it("college admins add moderators from their own members only, and can't remove themselves", async () => {
    const admin = await createUser({ college: "a", role: "admin" });
    const memberA = await createUser({ college: "a" });
    const memberB = await createUser({ college: "b" });
    await as(admin);
    const add = (user: string, college: string) =>
      attempt("INSERT INTO app.college_roles (college_id, user_id, role) VALUES ($1, $2, 'moderator')", [college, user]);
    expect((await add(memberA.id, COLLEGE_A)).ok).toBe(true);
    expect((await add(memberB.id, COLLEGE_A)).ok).toBe(false);
    expect((await add(memberB.id, COLLEGE_B)).ok).toBe(false);
    expect((await attempt("DELETE FROM app.college_roles WHERE user_id = $1", [admin.id])).rowCount).toBe(0);
  });

  it("a plain member can't promote themselves", async () => {
    const me = await createUser({ college: "a" });
    await as(me);
    expect((await attempt("INSERT INTO app.college_roles (college_id, user_id, role) VALUES ($1, $2, 'admin')", [COLLEGE_A, me.id])).ok).toBe(false);
  });

  it("the platform admin can suspend any college and approve domains", async () => {
    const platform = await createUser({ college: false, admin: true });
    const admin = await createUser({ college: "a", role: "admin" });
    await as(admin);
    expect((await attempt("INSERT INTO app.college_domains (domain, college_id) VALUES ('alumni.test-a.org', $1)", [COLLEGE_A])).ok).toBe(true);
    await asOwner();
    const [d] = await sql<{ status: string }>("SELECT status FROM app.college_domains WHERE domain = 'alumni.test-a.org'");
    expect(d.status).toBe("pending");
    await as(admin);
    expect((await attempt("UPDATE app.college_domains SET status = 'active' WHERE domain = 'alumni.test-a.org'")).rowCount).toBe(0);

    await as(platform);
    expect((await attempt("UPDATE app.college_domains SET status = 'active' WHERE domain = 'alumni.test-a.org'")).rowCount).toBe(1);
    expect((await attempt("UPDATE app.colleges SET status = 'suspended' WHERE id = $1", [COLLEGE_B])).rowCount).toBe(1);
  });
});

describe("college onboarding", () => {
  const create = (slug: string) =>
    attempt(
      `SELECT app.create_college('New College of Testing', 'NCT', $1, '#2F6B45', ARRAY['Library'], ARRAY['books']::app."Category"[]) AS id`,
      [slug],
    );

  it("a confirmed user on an unused domain creates a college and becomes its first admin; classmates join automatically", async () => {
    const classmate = await createUser({ domain: "newcollege.ac.in" });
    const founder = await createUser({ domain: "newcollege.ac.in" });
    expect(founder.collegeId).toBeNull();
    await as(founder);
    const r = await create("nct");
    expect(r.ok).toBe(true);
    const id = (r.rows[0] as { id: string }).id;
    await asOwner();
    const rows = await sql<{ id: string; college_id: string }>("SELECT id, college_id FROM app.profiles WHERE id = ANY($1)", [[founder.id, classmate.id]]);
    expect(rows.every((p) => p.college_id === id)).toBe(true);
    const [role] = await sql<{ role: string }>("SELECT role::text FROM app.college_roles WHERE user_id = $1", [founder.id]);
    expect(role.role).toBe("admin");
    const [domain] = await sql<{ status: string }>("SELECT status::text FROM app.college_domains WHERE domain = 'newcollege.ac.in'");
    expect(domain.status).toBe("active");
  });

  it("public email providers can't become a college", async () => {
    await as(await createUser({ college: false }));
    const r = await create("gmail-college");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/PUBLIC_DOMAIN/);
  });

  it("a domain (or a subdomain of one) that already belongs to a college is refused", async () => {
    await as(await createUser({ college: "a" }));
    expect((await create("dup-one")).error).toMatch(/DOMAIN_TAKEN/);
    // A user on a subdomain of college A's domain is already a member of A, so it's taken too.
    await asOwner();
    await as(await createUser({ domain: "law.test.edu.in" }));
    expect((await create("dup-two")).error).toMatch(/DOMAIN_TAKEN/);
  });

  it("unconfirmed emails and duplicate slugs are refused", async () => {
    await as(await createUser({ domain: "fresh.ac.in", confirmed: false }));
    expect((await create("fresh")).error).toMatch(/EMAIL_NOT_VERIFIED/);
    await asOwner();
    await as(await createUser({ domain: "another.ac.in" }));
    expect((await create("test-college-a")).error).toMatch(/colleges_slug_key|duplicate/);
  });

  it("is rate-limited per person", async () => {
    const founder = await createUser({ domain: "spam1.ac.in" });
    await asOwner();
    await sql(
      `INSERT INTO app.colleges (name, short_name, slug, pickup_spots, created_by)
       VALUES ('Spam One', 'S1', 'spam-one', ARRAY['x1'], $1), ('Spam Two', 'S2', 'spam-two', ARRAY['x1'], $1)`,
      [founder.id],
    );
    await as(founder);
    expect((await create("spam-three")).error).toMatch(/RATE_LIMIT:colleges/);
  });

  it("college admins can't add public domains or another college's domain", async () => {
    const admin = await createUser({ college: "a", role: "admin" });
    await as(admin);
    expect((await attempt("INSERT INTO app.college_domains (domain, college_id) VALUES ('gmail.com', $1)", [COLLEGE_A])).error).toMatch(/PUBLIC_DOMAIN/);
    expect((await attempt("INSERT INTO app.college_domains (domain, college_id) VALUES ('other-test.ac.in', $1)", [COLLEGE_A])).ok).toBe(false);
    expect((await attempt("INSERT INTO app.college_domains (domain, college_id) VALUES ('cs.other-test.ac.in', $1)", [COLLEGE_A])).error).toMatch(/DOMAIN_TAKEN/);
  });
});
