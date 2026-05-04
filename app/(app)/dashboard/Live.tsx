"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function DashboardLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();

    const channel = supabase
      .channel("viajes-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "viajes" },
        () => router.refresh()
      )
      .subscribe();

    const interval = window.setInterval(async () => {
      try {
        await fetch("/api/copeland/sync", { method: "POST" });
      } catch {
        // silent
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
