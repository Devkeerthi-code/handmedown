import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getMe } from "@/lib/auth";
import { getDirectory, type DirectoryEntry } from "@/lib/college";
import { logError } from "@/lib/errors";
import { Icon, type IconName } from "@/components/Icon";
import { Illustration } from "@/components/Illustration";
import { CollegeDirectory } from "@/components/college/CollegeDirectory";
import { ErrorState } from "@/components/ErrorState";
import { Footer } from "@/components/chrome/Footer";
import { HeroDrift } from "@/components/home/HeroDrift";

async function load() {
  const me = await getMe();
  try {
    return { me, colleges: await getDirectory(), failed: false };
  } catch (error) {
    unstable_rethrow(error);
    logError("directory", error);
    return { me, colleges: [] as DirectoryEntry[], failed: true };
  }
}

export default async function PlatformHome() {
  const { me, colleges, failed } = await load();
  const mine = me?.collegeSlug ? colleges.find((c) => c.slug === me.collegeSlug) : undefined;

  return (
    <>
      <section className="hero" aria-labelledby="heroTitle">
        <span className="hero__circle hero__circle--a" data-drift="1.0" />
        <span className="hero__circle hero__circle--b" data-drift="-0.7" />
        <div className="container hero__in">
          <div style={{ display: "grid", gap: "var(--s5)", position: "relative" }}>
            <span className="kicker">
              <Icon name="verified" />
              One marketplace per campus, students only
            </span>
            <h1 id="heroTitle">Your seniors’ stuff, at junior prices.</h1>
            <p className="hero__lede">
              Every college gets its own HandMeDown: textbooks, cycles, coolers and lab coats passed from graduating
              seniors to juniors. Only students with your college email can post or chat.
            </p>
            <div className="hero__ctas" style={{ display: "flex" }}>
              {mine ? (
                <Link className="btn btn--primary btn--lg" href={`/c/${mine.slug}`}>
                  Go to {mine.shortName}
                </Link>
              ) : (
                <Link className="btn btn--primary btn--lg" href="#colleges">
                  Find your college
                </Link>
              )}
              <Link className="btn btn--outline btn--lg" href="/start">
                Add your college
              </Link>
            </div>
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
          </div>
        </div>
        <HeroDrift />
      </section>

      <section className="section container" id="colleges" aria-labelledby="dirTitle">
        <div className="section__head">
          <div>
            <h2 className="section__title" id="dirTitle">
              Find your college
            </h2>
            <p className="section__sub">Anyone can browse. Posting and chatting need that college&apos;s email.</p>
          </div>
        </div>
        {failed ? (
          <ErrorState title="Couldn't load colleges" retryHref="/" />
        ) : (
          <CollegeDirectory colleges={colleges} myCollegeSlug={me?.collegeSlug ?? null} />
        )}
      </section>

      <section className="container" aria-labelledby="bringTitle">
        <div className="banner">
          <span className="banner__tags" aria-hidden="true" />
          <div>
            <h2 id="bringTitle">Your college isn&apos;t here yet?</h2>
            <p>
              Sign in with your college email and set it up in two minutes: name, colours, meeting spots. You become its
              first admin. No code, no forms to email anyone.
            </p>
          </div>
          <Link className="btn btn--accent btn--lg" href="/start">
            <Icon name="plus" />
            Bring HandMeDown to your college
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
          <Step n={1} icon="verified" title="Join with your college email">
            Your college is recognised from the part after the @. Personal emails can browse, college emails can post
            and chat.
          </Step>
          <Step n={2} icon="chat" title="Chat here, not on WhatsApp">
            Your phone number stays private. Every chat is pinned to its listing, and stays inside your college.
          </Step>
          <Step n={3} icon="pin" title="Meet at a campus spot">
            Each college lists its own meeting spots. Hand it over, mark it sold, done.
          </Step>
        </ol>
      </section>
      <Footer college={null} />
    </>
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
