import Link from "next/link";
import { isMemberOf, isStaffOf, type Me } from "@/lib/auth";
import type { CollegeInfo } from "@/lib/college";
import { Icon } from "@/components/Icon";
import { CollegeLogo } from "@/components/college/CollegeLogo";
import { Logo } from "./Logo";
import { DesktopNav, TabBar, type NavItem } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

type Props = { me: Me | null; unread: number; college: CollegeInfo | null };

function collegeNav(me: Me | null, college: CollegeInfo, unread: number) {
  const base = `/c/${college.slug}`;
  const member = isMemberOf(me, college.id);
  const items: NavItem[] = [
    { href: base, label: "Browse", icon: "grid" },
    { href: `${base}/sell`, label: "Sell", icon: "plus" },
    { href: `${base}/chats`, label: "Chats", icon: "chat", badge: member ? unread : 0 },
    { href: `${base}/alerts`, label: "Alerts", icon: "bell" },
  ];
  if (isStaffOf(me, college.id) || me?.isAdmin) items.push({ href: `${base}/admin`, label: "Manage", icon: "shield" });
  const tabs: NavItem[] = [
    { href: base, label: "Browse", icon: "grid" },
    { href: `${base}/alerts`, label: "Alerts", icon: "bell" },
    { href: `${base}/sell`, label: "Sell", icon: "plus", fab: true },
    { href: `${base}/chats`, label: "Chats", icon: "chat", badge: member ? unread : 0 },
    { href: me ? "/account" : "/login", label: me ? "You" : "Sign in", icon: "user" },
  ];
  return { items, tabs, chatHref: `${base}/chats` };
}

function platformNav(me: Me | null, unread: number) {
  const items: NavItem[] = [
    { href: "/", label: "Colleges", icon: "grid" },
    { href: "/start", label: "Add your college", icon: "plus" },
  ];
  if (me?.collegeSlug) items.push({ href: `/c/${me.collegeSlug}`, label: "My college", icon: "verified" });
  if (me?.isAdmin) items.push({ href: "/admin", label: "Platform admin", icon: "shield" });
  const tabs: NavItem[] = [
    { href: "/", label: "Colleges", icon: "grid" },
    me?.collegeSlug
      ? { href: `/c/${me.collegeSlug}`, label: "My college", icon: "verified" }
      : { href: "/start", label: "Add college", icon: "plus" },
    me?.collegeSlug
      ? { href: `/c/${me.collegeSlug}/sell`, label: "Sell", icon: "plus", fab: true }
      : { href: "/start", label: "Start", icon: "plus", fab: true },
    me?.collegeSlug
      ? { href: `/c/${me.collegeSlug}/chats`, label: "Chats", icon: "chat", badge: unread }
      : { href: "/account", label: "Join", icon: "lock" },
    { href: me ? "/account" : "/login", label: me ? "You" : "Sign in", icon: "user" },
  ];
  return { items, tabs, chatHref: me?.collegeSlug ? `/c/${me.collegeSlug}/chats` : null };
}

/** Platform chrome on "/" pages; inside /c/[slug] the brand becomes the college, HandMeDown stays as the small mark. */
export function TopBar({ me, unread, college }: Props) {
  const { items, tabs, chatHref } = college ? collegeNav(me, college, unread) : platformNav(me, unread);
  const showChat = chatHref && (!college || isMemberOf(me, college.id));

  return (
    <>
      <header className="topbar">
        <div className="topbar__in container">
          {college ? (
            <div className="logo college-brand">
              <Link href={`/c/${college.slug}`} aria-label={`${college.name}, go to listings`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CollegeLogo name={college.name} shortName={college.shortName} logoUrl={college.logoUrl} size="sm" decorative />
                <span className="college-brand__text">{college.shortName}</span>
              </Link>
              <Link className="college-brand__platform" href="/" aria-label="All colleges on HandMeDown">
                on HandMeDown
              </Link>
            </div>
          ) : (
            <Logo />
          )}
          <DesktopNav items={items} />
          <div className="topbar__actions">
            <ThemeToggle />
            {showChat ? (
              <Link className="icon-tile icon-tile--accent chat-tile" href={chatHref} aria-label={unread ? `Chats, ${unread} unread` : "Chats"}>
                <Icon name="chat" />
                {unread ? (
                  <span className="badge-dot" aria-hidden="true">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {me ? (
              <Link className="icon-tile" href="/account" aria-label={`Your account, ${me.displayName}`}>
                <Icon name="user" />
              </Link>
            ) : (
              <Link className="btn btn--outline btn--sm topbar__signin" href="/login">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <TabBar items={tabs} />
    </>
  );
}
