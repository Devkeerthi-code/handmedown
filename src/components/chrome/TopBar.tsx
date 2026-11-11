import Link from "next/link";
import type { Me } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { Logo } from "./Logo";
import { DesktopNav, TabBar, type NavItem } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ me, unread }: { me: Me | null; unread: number }) {
  const items: NavItem[] = [
    { href: "/", label: "Browse", icon: "grid" },
    { href: "/sell", label: "Sell", icon: "plus" },
    { href: "/chats", label: "Chats", icon: "chat", badge: unread },
    { href: "/alerts", label: "Alerts", icon: "bell" },
  ];
  if (me?.isAdmin) items.push({ href: "/admin", label: "Admin", icon: "shield" });

  const tabs: NavItem[] = [
    { href: "/", label: "Browse", icon: "grid" },
    { href: "/alerts", label: "Alerts", icon: "bell" },
    { href: "/sell", label: "Sell", icon: "plus", fab: true },
    { href: "/chats", label: "Chats", icon: "chat", badge: unread },
    me?.isAdmin
      ? { href: "/admin", label: "Admin", icon: "shield" }
      : { href: me ? "/account" : "/login", label: me ? "You" : "Sign in", icon: "user" },
  ];

  return (
    <>
      <header className="topbar">
        <div className="topbar__in container">
          <Logo />
          <DesktopNav items={items} />
          <div className="topbar__actions">
            <ThemeToggle />
            <Link
              className="icon-tile icon-tile--accent chat-tile"
              href="/chats"
              aria-label={unread ? `Chats, ${unread} unread` : "Chats"}
            >
              <Icon name="chat" />
              {unread ? (
                <span className="badge-dot" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            {me ? (
              <Link className="icon-tile" href="/account" aria-label={`Your account, ${me.displayName}`}>
                <Icon name="user" />
              </Link>
            ) : (
              <Link className="btn btn--outline btn--sm" href="/login">
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
