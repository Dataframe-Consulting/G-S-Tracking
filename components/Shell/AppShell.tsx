"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LeafLogo } from "@/components/brand/LeafLogo";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import toast from "react-hot-toast";

const icons: Record<string, React.ReactNode> = {
  Dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Viajes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <rect x="1" y="3" width="15" height="13" rx="1.5"/>
      <path d="M16 8h4l3 4v4h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Alertas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>
    </svg>
  ),
  Configuración: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
};

const NAV = [
  { href: "/dashboard",     label: "Dashboard" },
  { href: "/viajes",        label: "Viajes" },
  { href: "/alertas",       label: "Alertas" },
  { href: "/configuracion", label: "Configuración" }
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
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Desktop sidebar (hover-expand) ── */}
      <aside className="
        group/sidebar
        hidden md:flex flex-col
        fixed top-0 left-0 h-screen z-30
        w-16 hover:w-56
        bg-brand-900 text-brand-50
        transition-[width] duration-200 ease-in-out
        overflow-hidden
      ">
        {/* Logo */}
        <div className="flex items-center gap-3 px-[14px] py-5 border-b border-brand-800 h-[68px] shrink-0">
          <LeafLogo className="w-9 h-9 text-brand-200 shrink-0" />
          <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden">
            <div className="font-display font-extrabold text-sm tracking-widest leading-none text-white">
              AGROTRACK
            </div>
            <div className="text-[9px] tracking-widest uppercase text-brand-200/60 mt-0.5">
              Agriculture Logistics
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 text-sm overflow-hidden">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors ${
                  active
                    ? "bg-brand-700 text-white"
                    : "text-brand-300 hover:bg-brand-800 hover:text-white"
                }`}
              >
                {icons[item.label]}
                <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden text-sm font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-brand-800 shrink-0 overflow-hidden">
          <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden px-2.5 mb-2">
            <div className="text-[11px] text-brand-400 truncate">{email ?? "—"}</div>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-brand-300 hover:bg-brand-800 hover:text-white transition-colors"
          >
            {/* Logout icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 whitespace-nowrap text-sm font-medium">
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      {/* ── Mobile sidebar (overlay) ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`
        fixed top-0 left-0 h-screen z-50 w-64
        bg-brand-900 text-brand-50
        flex flex-col
        transition-transform duration-200 ease-in-out
        md:hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-800">
          <LeafLogo className="w-9 h-9 text-brand-200 shrink-0" />
          <div>
            <div className="font-display font-extrabold text-sm tracking-widest text-white">AGROTRACK</div>
            <div className="text-[9px] tracking-widest uppercase text-brand-200/60 mt-0.5">Agriculture Logistics</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 text-sm">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium ${
                  active
                    ? "bg-brand-700 text-white"
                    : "text-brand-300 hover:bg-brand-800 hover:text-white"
                }`}
              >
                {icons[item.label]}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-brand-800">
          <div className="text-xs text-brand-400 mb-2 truncate">{email ?? "—"}</div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-brand-300 hover:bg-brand-800 hover:text-white transition-colors text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-col min-w-0 flex-1 md:ml-16">
        <header className="sticky top-0 z-20 bg-brand-50/80 backdrop-blur border-b border-brand-100 px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-lg border border-brand-200 p-1.5 text-brand-900"
            aria-label="Menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="font-display font-semibold text-brand-900 tracking-wide">
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? "AGROTRACK"}
          </div>
        </header>
        <main className="p-5 md:p-8 flex-1 min-w-0">{children}</main>
      </div>

    </div>
  );
}
