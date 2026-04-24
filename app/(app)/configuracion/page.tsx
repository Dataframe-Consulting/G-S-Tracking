import Link from "next/link";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { PerfilForm } from "./PerfilForm";
import { LogoEmpresa } from "@/components/configuracion/LogoEmpresa";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/configuracion/usuarios",
    title: "Usuarios",
    desc: "Gestiona accesos y roles (Master, Operador, Visor)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    )
  },
  {
    href: "/configuracion/productos",
    title: "Productos",
    desc: "Catálogo de productos con rangos de temperatura",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    href: "/configuracion/clientes",
    title: "Clientes",
    desc: "Directorio de clientes y contactos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
  {
    href: "/configuracion/lugares",
    title: "Lugares de carga",
    desc: "Puntos de origen y carga de mercancía",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    )
  },
  {
    href: "/configuracion/transportistas",
    title: "Transportistas",
    desc: "Directorio de transportistas y contactos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="1" y="3" width="15" height="13" rx="1.5"/>
        <path d="M16 8h4l3 4v4h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    )
  }
];

export default async function ConfiguracionPage() {
  const supabase = createServerSupabase();
  const service = createServiceSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: empresaConfig }] = await Promise.all([
    service
      .from("user_profiles")
      .select("nombre, role")
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
    service
      .from("empresa_config")
      .select("logo_url")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">
            Configuración
          </h1>
          <p className="text-sm text-brand-500 mt-0.5">
            Administra tu perfil y los catálogos de la plataforma.
          </p>
        </div>
        <LogoEmpresa
          logoUrl={empresaConfig?.logo_url ?? null}
          isMaster={profile?.role === "master"}
        />
      </div>

      {/* Perfil */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
            Mi perfil
          </span>
          <div className="flex-1 h-px bg-brand-100" />
        </div>
        <PerfilForm
          nombre={profile?.nombre ?? ""}
          email={user?.email ?? ""}
          role={(profile?.role as string) ?? "master"}
        />
      </section>

      {/* Catálogos */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
            Catálogos
          </span>
          <div className="flex-1 h-px bg-brand-100" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group bg-white rounded-2xl border border-brand-100 p-5 flex flex-col gap-3 hover:border-brand-500 hover:shadow-md transition-all"
            >
              <div className="text-brand-700 group-hover:text-brand-900 transition-colors">
                {c.icon}
              </div>
              <div>
                <div className="font-display font-semibold text-brand-900 group-hover:text-brand-700 transition-colors">
                  {c.title}
                </div>
                <div className="text-xs text-brand-400 mt-0.5 leading-relaxed">{c.desc}</div>
              </div>
              <div className="text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Ver →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
