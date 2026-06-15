import Link from "next/link";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { Role, UserProfile } from "@/lib/types";
import { UsuariosClient } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = createServerSupabase();
  const service = createServiceSupabase();

  const [{ data: { user } }, listResult, { data: profiles }] = await Promise.all([
    supabase.auth.getUser(),
    service.auth.admin.listUsers(),
    service.from("user_profiles").select("*")
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; role: string; nombre: string | null }) => [p.user_id, p])
  );

  const usuarios: UserProfile[] = (listResult.data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    role: ((profileMap.get(u.id) as { role: Role } | undefined)?.role ?? "master") as Role,
    nombre: (profileMap.get(u.id) as { nombre: string | null } | undefined)?.nombre ?? null,
    created_at: u.created_at
  }));

  const currentUserRole: Role =
    ((profileMap.get(user?.id ?? "") as { role: Role } | undefined)?.role ?? "master") as Role;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Usuarios
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Gestiona los accesos y roles de la plataforma.
        </p>
      </div>

      {/* Role legend */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { role: "master",   label: "Master",    desc: "Acceso completo — cargas, usuarios y configuración", color: "border-brand-900 bg-brand-900 text-white" },
          { role: "operador", label: "Operador",  desc: "Crea y modifica cargas, ve toda la plataforma", color: "border-accent bg-accent text-white" },
          { role: "visor",    label: "Visor",     desc: "Solo lectura — no puede modificar nada", color: "border-brand-200 bg-white text-brand-700" }
        ].map((r) => (
          <div key={r.role} className={`rounded-xl border-2 px-4 py-3 ${r.color}`}>
            <div className="font-display font-bold text-sm">{r.label}</div>
            <div className={`text-xs mt-0.5 ${r.role === "visor" ? "text-brand-500" : "opacity-80"}`}>{r.desc}</div>
          </div>
        ))}
      </div>

      <UsuariosClient usuarios={usuarios} currentUserId={user?.id ?? ""} currentUserRole={currentUserRole} />
    </div>
  );
}
