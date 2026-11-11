import Link from "next/link";
import type { Me } from "@/lib/auth";
import type { CollegeInfo } from "@/lib/college";
import { Icon } from "@/components/Icon";
import { VerifyGate } from "@/components/sell/VerifyGate";

/**
 * Shown instead of Sell / Chats / Alerts to anyone who isn't a verified member of THIS college:
 * signed out, not verified anywhere yet, a member of another college, banned, or the college is suspended.
 */
export function MemberGate({ me, college, action }: { me: Me; college: CollegeInfo; action: string }) {
  if (me.banned) {
    return (
      <p className="notice notice--error">
        <Icon name="ban" />
        Your account can&apos;t {action}. If you think this is a mistake, contact the HandMeDown team.
      </p>
    );
  }
  if (college.status !== "active") {
    return (
      <div className="lock">
        <span className="lock__icon">
          <Icon name="lock" />
        </span>
        <h1 className="section__title">{college.shortName} is suspended</h1>
        <p className="section__sub">You can still look around, but nobody can {action} here right now.</p>
        <Link className="btn btn--outline" href={`/c/${college.slug}`}>
          Back to listings
        </Link>
      </div>
    );
  }
  if (me.collegeId && me.collegeSlug && me.collegeId !== college.id) {
    return (
      <div className="lock">
        <span className="lock__icon">
          <Icon name="lock" />
        </span>
        <h1 className="section__title">This is {college.shortName}&apos;s marketplace</h1>
        <p className="section__sub" style={{ maxWidth: "46ch" }}>
          You&apos;re a member of {me.collegeName}. Only verified {college.shortName} students can {action} here. Moved
          colleges? Switch your account to your new college email.
        </p>
        <div className="state__actions">
          <Link className="btn btn--primary" href={`/c/${me.collegeSlug}`}>
            Go to {me.collegeName}
          </Link>
          <Link className="btn btn--outline" href="/account">
            Switch college email
          </Link>
        </div>
      </div>
    );
  }
  return <VerifyGate collegeName={college.name} currentEmail={me.email} />;
}
