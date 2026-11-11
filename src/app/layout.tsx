import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { unstable_rethrow } from "next/navigation";
import "./globals.css";
import { getMe } from "@/lib/auth";
import { UnreadWatcher } from "@/components/chrome/UnreadWatcher";
import { themeScript } from "@/components/chrome/ThemeToggle";
import { PressPhysics } from "@/components/PressPhysics";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HandMeDown · Campus marketplaces for students", template: "%s · HandMeDown" },
  description:
    "Every college gets its own marketplace: seniors hand down textbooks, cycles and hostel gear to juniors. Search by title or ISBN and chat without sharing your number.",
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

async function viewerId() {
  try {
    return (await getMe())?.id ?? null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const userId = await viewerId();
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
          {children}
          <PressPhysics />
          {userId ? <UnreadWatcher userId={userId} /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
