"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Listens on your private "user:<id>" channel. When someone messages you, the
 * server components re-render so unread badges update without a reload.
 */
export function UnreadWatcher({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer = 0;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`user:${userId}`, { config: { private: true } })
        .on("broadcast", { event: "inbox" }, () => {
          // Coalesce bursts of messages into one refresh.
          window.clearTimeout(timer);
          timer = window.setTimeout(() => router.refresh(), 250);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
