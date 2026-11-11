import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { getMe, isMemberOf } from "@/lib/auth";
import { getCollegeBySlug, type CollegeInfo } from "@/lib/college";
import { CATEGORIES } from "@/lib/catalog";
import { logError } from "@/lib/errors";
import { requestTime } from "@/lib/format";
import { firstPage, getCampusStats, getCategoryCounts, type CampusStats } from "@/lib/listings/queries";
import { filtersToQuery, parseSearchFilters } from "@/lib/validation";
import { Icon, type IconName } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { Browse } from "@/components/browse/Browse";
import { AlertBand } from "@/components/home/AlertBand";
import { HeroDrift } from "@/components/home/HeroDrift";
import { Footer } from "@/components/chrome/Footer";
import { ErrorState } from "@/components/ErrorState";

async function loadHome(college: CollegeInfo, searchParams: Record<string, string | string[] | undefined>) {
  const viewer = await getMe();
  const filters = parseSearchFilters(searchParams);
  if (filters.category && !college.categories.includes(filters.category)) filters.category = undefined;
  try {
    const [page, stats, counts] = await Promise.all([
      firstPage(viewer, college.id, filters),
      getCampusStats(college.id),
      getCategoryCounts(college.id),
    ]);
    return { viewer, filters, page, stats, counts, failed: false as const, now: requestTime() };
  } catch (error) {
    unstable_rethrow(error);
    logError("home", error);
    return { viewer, filters, page: null, stats: null, counts: {} as Awaited<ReturnType<typeof getCategoryCounts>>, failed: true as const, now: requestTime() };
  }
}

export default async function CollegeHomePage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const college = await getCollegeBySlug((await params).slug);
  if (!college) notFound();
  const sp = await searchParams;
  const { viewer, filters, page, stats, counts, failed, now } = await loadHome(college, sp);
  const base = `/c/${college.slug}`;
  const member = isMemberOf(viewer, college.id);

  return (
    <>
      {sp.welcome === "1" ? (
        <p className="notice container" role="status" style={{ marginTop: 16 }}>
          <Icon name="check" />
          {college.name} is live. Share {base} with your classmates. You can change branding, spots and moderators under Manage.
        </p>
      ) : null}
      <Hero stats={stats} college={college} member={member} signedIn={viewer !== null} />

      <section className="section container" aria-labelledby="catTitle" style={{ paddingBottom: 0 }}>
        <div className="section__head">
          <div>
            <h2 className="section__title" id="catTitle">
              Browse by category
            </h2>
            <p className="section__sub">Tap one to filter the listings below.</p>
          </div>
        </div>
        <div className="cats" role="group" aria-label="Categories">
          {CATEGORIES.filter((c) => college.categories.includes(c.id)).map((c) => {
            const active = filters.category === c.id;
            const qs = filtersToQuery({ ...filters, category: active ? undefined : c.id }).toString();
            const n = counts[c.id] ?? 0;
            return (
              <Link
                key={c.id}
                className="cat"
                href={`${base}${qs ? `?${qs}` : ""}#listings`}
                scroll={false}
                aria-pressed={active}
                style={{ background: `var(--${c.tint})` }}
              >
                <span className="cat__art">
                  <Illustration name={c.art} />
                </span>
                <span className="cat__label">
                  <b>{c.label}</b>
                  <small>{n === 0 ? "Nothing yet" : `${n} listed`}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section container" id="listings" aria-labelledby="listTitle">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="listTitle">
              Fresh on campus
            </h2>
            <p className="section__sub">
              Posted by verified {college.shortName} students. Anything tagged DEMO is an example listing.
            </p>
          </div>
        </div>
        {failed || !page ? (
          <ErrorState title="Couldn't load listings" retryHref={base} />
        ) : (
          <Browse filters={filters} initial={page} viewerId={viewer?.id ?? null} now={now} base={base} collegeId={college.id} />
        )}
      </section>

      <section className="container" aria-labelledby="passTitle">
        <div className="banner">
          <span className="banner__tags" aria-hidden="true" />
          <div>
            <h2 id="passTitle">Graduating? Pass it on.</h2>
            <p>
              List your books, cycle and hostel things in under a minute. Juniors get them cheap and you clear your room
              before you leave.
            </p>
          </div>
          <Link className="btn btn--accent btn--lg" href={`${base}/sell`}>
            <Icon name="plus" />
            Post a listing
          </Link>
        </div>
      </section>

      <section className="section container" id="how" aria-labelledby="howTitle">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="howTitle">
              How it works
            </h2>
            <p className="section__sub">Three steps, no WhatsApp group required.</p>
          </div>
        </div>
        <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <Step n={1} icon="camera" title="Post in a minute">
            Add up to 5 photos, choose a price, Free or Exchange, and pick a campus spot. Photos shrink on your phone
            first, so it works on hostel Wi-Fi.
          </Step>
          <Step n={2} icon="chat" title="Chat here, not on WhatsApp">
            Your phone number stays private. Every chat is pinned to its listing, so nobody has to ask “which cycle?”
          </Step>
          <Step n={3} icon="pin" title="Meet at a campus spot">
            Hand it over at the library, a hostel lobby or the canteen. Mark it sold and the listing closes itself.
          </Step>
        </ol>
      </section>

      <AlertBand base={base} />
      <Footer college={{ name: college.name, base }} />
    </>
  );
}

function Hero({
  stats,
  college,
  member,
  signedIn,
}: {
  stats: CampusStats | null;
  college: CollegeInfo;
  member: boolean;
  signedIn: boolean;
}) {
  const hasStats = stats && stats.live + stats.handedDown > 0;
  return (
    <section className="hero" aria-labelledby="heroTitle">
      <span className="hero__circle hero__circle--a" data-drift="1.0" />
      <span className="hero__circle hero__circle--b" data-drift="-0.7" />
      <div className="container hero__in">
        <div style={{ display: "grid", gap: "var(--s5)", position: "relative" }}>
          <span className="kicker">
            <Icon name="verified" />
            Only for students of {college.name}
          </span>
          <h1 id="heroTitle">Your seniors’ stuff, at junior prices.</h1>
          <p className="hero__lede">
            Textbooks, cycles, coolers and lab coats from students who are graduating. Search by title or ISBN, chat
            without sharing your number, and meet on campus.
          </p>
          <div className="hero__ctas">
            <Link className="btn btn--primary btn--lg" href="#listings">
              Browse listings
            </Link>
            {member ? (
              <Link className="btn btn--outline btn--lg" href={`/c/${college.slug}/sell`}>
                Sell an item
              </Link>
            ) : (
              <Link className="btn btn--outline btn--lg" href={signedIn ? "/account" : "/signup"}>
                Join with your {college.shortName} email
              </Link>
            )}
          </div>
          {hasStats ? (
            <div className="stats" aria-label="Live campus numbers">
              <div>
                <div className="stat__n">{stats.live.toLocaleString("en-IN")}</div>
                <div className="stat__l">listings up now</div>
              </div>
              <div>
                <div className="stat__n">{stats.handedDown.toLocaleString("en-IN")}</div>
                <div className="stat__l">items handed down</div>
              </div>
              <div>
                <div className="stat__n">{stats.verified.toLocaleString("en-IN")}</div>
                <div className="stat__l">verified students</div>
              </div>
            </div>
          ) : (
            <span className="demo-note">
              <Icon name="info" />
              Just launched. The first listings you see are demo examples. Be the first real one.
            </span>
          )}
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="hero__frame">
            <div>
              <Illustration name="books" />
            </div>
            <div>
              <Illustration name="cycle" />
            </div>
            <div>
              <Illustration name="calculator" />
            </div>
          </div>
          <span className="float-chip float-chip--a" data-drift="-1.6">
            <Icon name="swap" />
            Seniors to juniors, hand to hand
          </span>
          <div className="float-card" data-drift="1.4">
            <div className="float-card__img">
              <Illustration name="calculator" />
            </div>
            <div>
              <b>Scientific calculator</b>
              <small>Example · Hostel Block C</small>
            </div>
          </div>
        </div>
      </div>
      <HeroDrift />
    </section>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <li className="step">
      <span className="step__num" aria-hidden="true">
        0{n}
      </span>
      <span className="step__n">
        <Icon name={icon} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}
