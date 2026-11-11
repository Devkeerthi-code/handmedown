import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollegeBySlug } from "@/lib/college";
import { loadChrome } from "@/lib/chrome";
import { deriveCollegeTheme, themeCssVars } from "@/lib/theme";
import { TopBar } from "@/components/chrome/TopBar";
import { Icon } from "@/components/Icon";

export async function generateMetadata({ params }: LayoutProps<"/c/[slug]">): Promise<Metadata> {
  const college = await getCollegeBySlug((await params).slug).catch(() => null);
  if (!college) return { title: "College not found" };
  return {
    title: { default: `${college.shortName} marketplace`, template: `%s · ${college.shortName} · HandMeDown` },
    description: `Buy, sell and give away things at ${college.name}. Only verified ${college.shortName} students can post.`,
  };
}

/**
 * Everything under /c/[slug] is one college's marketplace. Its accent is applied through
 * CSS variables (accessible light/dark shades derived in lib/theme.ts) on this wrapper.
 */
export default async function CollegeLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const college = await getCollegeBySlug((await params).slug);
  if (!college) notFound();
  const { me, unread } = await loadChrome();
  const vars = themeCssVars(deriveCollegeTheme(college.accent));

  return (
    <div data-college={college.slug} style={vars as React.CSSProperties}>
      <TopBar me={me} unread={unread} college={college} />
      {college.status === "suspended" ? (
        <p className="notice notice--warn container" role="status" style={{ marginTop: 12 }}>
          <Icon name="lock" />
          This college is suspended by the HandMeDown team. You can look around, but nothing new can be posted or sent.
        </p>
      ) : null}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
