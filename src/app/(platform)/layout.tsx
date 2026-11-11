import { loadChrome } from "@/lib/chrome";
import { TopBar } from "@/components/chrome/TopBar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { me, unread } = await loadChrome();
  return (
    <>
      <TopBar me={me} unread={unread} college={null} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
