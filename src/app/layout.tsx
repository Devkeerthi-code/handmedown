import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getMe } from "@/lib/auth";
import { getUnreadTotal } from "@/lib/chat/queries";
import { CAMPUS } from "@/config/campus";
import { TopBar } from "@/components/chrome/TopBar";
import { UnreadWatcher } from "@/components/chrome/UnreadWatcher";
import { themeScript } from "@/components/chrome/ThemeToggle";
import { PressPhysics } from "@/components/PressPhysics";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HandMeDown · Buy and sell on campus", template: "%s · HandMeDown" },
  description: `Textbooks, cycles, coolers and lab coats from ${CAMPUS.name} students who are graduating. Search by title or ISBN and chat without sharing your number.`,
  applicationName: "HandMeDown",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#17110C" },
  ],
};

async function loadChrome() {
  try {
    const me = await getMe();
    const unread = me ? await getUnreadTotal(me) : 0;
    return { me, unread };
  } catch {
    // The header must still render if the database is briefly unreachable.
    return { me: null, unread: 0 };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { me, unread } = await loadChrome();
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <ToastProvider>
          <TopBar me={me} unread={unread} />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <PressPhysics />
          {me ? <UnreadWatcher userId={me.id} /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
