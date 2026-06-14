import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Prefijo del registro de auditoría que marca un cambio de status de una OV.
// Es la ÚNICA fuente de "cuándo concluyó el viaje" sin tocar la BD: se comparte
// entre la ruta que lo escribe (PATCH de OV) y las consultas que lo filtran para
// ordenar Completados/Rechazados. Si cambias este texto, cambia en ambos lados solo.
export const STATUS_CHANGE_AUDIT_PREFIX = "Cambió status de OV";

type AuditTipo = "CREACION" | "MODIFICACION";

interface AuditTarget {
  viaje_id: string;
  ov_id?: string | null;
  tipo: AuditTipo;
}

// Resuelve el usuario autenticado a un nombre legible (nombre > email).
async function resolveUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null as string | null, nombre: null as string | null };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("nombre, email")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    nombre: profile?.nombre ?? profile?.email ?? user.email ?? null,
  };
}

// Registra UN cambio. Nunca lanza: la auditoría es secundaria a la operación real.
export async function logAudit(
  supabase: SupabaseClient,
  params: AuditTarget & { descripcion: string }
) {
  await logAuditMany(supabase, params, [params.descripcion]);
}

// Registra VARIOS cambios que comparten viaje/ov/tipo, resolviendo al usuario una sola vez.
export async function logAuditMany(
  supabase: SupabaseClient,
  target: AuditTarget,
  descripciones: string[]
) {
  if (descripciones.length === 0) return;
  try {
    const { id, nombre } = await resolveUser(supabase);
    const rows = descripciones.map((descripcion) => ({
      viaje_id: target.viaje_id,
      ov_id: target.ov_id ?? null,
      user_id: id,
      user_nombre: nombre,
      tipo: target.tipo,
      descripcion,
    }));
    await supabase.from("auditoria").insert(rows);
  } catch (e) {
    console.error("logAudit error:", e);
  }
}
