"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LeafLogo } from "@/components/brand/LeafLogo";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import toast from "react-hot-toast";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/cargas", label: "Cargas", icon: "🚚" },
  { href: "/alertas", label: "Alertas", icon: "⚠️" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" }
];

export function AppShell({
  email,
  children
}: {
  email?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside
        className={`bg-brand-900 text-brand-50 md:block ${
          open ? "block" : "hidden"
        } md:sticky top-0 md:h-screen`}
      >
        <div className="px-5 py-5 flex items-center gap-2 border-b border-brand-800">
          <LeafLogo className="w-8 h-8 text-brand-100" />
          <div>
            <div className="text-lg font-bold leading-none">AgroTrack</div>
            <div className="text-[11px] text-brand-200/80">Logística agrónoma</div>
          </div>
        </div>
        <nav className="px-2 py-4 space-y-1 text-sm">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                  active
                    ? "bg-brand-700 text-white"
                    : "text-brand-100 hover:bg-brand-800"
                }`}
                onClick={() => setOpen(false)}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 mt-auto text-xs text-brand-200/80 border-t border-brand-800">
          <div className="truncate mb-2">{email ?? "—"}</div>
          <button
            onClick={logout}
            className="w-full rounded-md bg-brand-800 hover:bg-brand-700 px-3 py-1.5 text-brand-50"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden rounded-md border border-slate-300 p-1.5"
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="font-semibold text-slate-800">
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? "AgroTrack"}
          </div>
        </header>
        <main className="p-4 md:p-6 flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
