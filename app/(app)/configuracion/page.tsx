import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { Role, UserProfile } from "@/lib/types";
import { ConfiguracionForm } from "./ConfiguracionForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
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

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500">
          Gestión de usuarios y permisos de la plataforma.
        </p>
      </div>
      <ConfiguracionForm usuarios={usuarios} currentUserId={user?.id ?? ""} />
    </div>
  );
}
