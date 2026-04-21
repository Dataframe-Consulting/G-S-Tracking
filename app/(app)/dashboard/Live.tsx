"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Subscribes to cargas changes via Supabase Realtime AND triggers a
 * Copeland sync every 3 minutes. Either signal refreshes the server
 * component tree to reflect new data.
 */
export function DashboardLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();

    const channel = supabase
      .channel("cargas-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cargas" },
        () => router.refresh()
      )
      .subscribe();

    const interval = window.setInterval(async () => {
      try {
        await fetch("/api/copeland/sync", { method: "POST" });
      } catch {
        // silent — next tick will retry
      }
      router.refresh();
    }, 3 * 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
