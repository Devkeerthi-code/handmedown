"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; fab?: boolean };

/** "/" and "/c/<slug>" are home links: active on themselves and on listing pages beneath them. */
function isActive(pathname: string, href: string) {
  if (href === "/" || /^\/c\/[^/]+$/.test(href)) return pathname === href || pathname.startsWith(`${href}/l/`);
  return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile bottom tab bar with the raised Sell button in the middle. */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={item.fab ? "tabbar__sell" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.fab ? (
              <span className="tabbar__fab">
                <Icon name={item.icon} />
              </span>
            ) : (
              <span className="tabbar__ic">
                <Icon name={item.icon} />
                {item.badge ? (
                  <span className="badge-dot" aria-hidden="true">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
            )}
            <span>
              {item.label}
              {item.badge ? <span className="sr-only">, {item.badge} unread</span> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
