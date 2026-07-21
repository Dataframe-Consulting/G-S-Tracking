import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { closeTrip, copelandTripId } from "@/lib/copeland";
import { logAudit } from "@/lib/audit";

// Deshabilitar un termógrafo (Cambio 1). A diferencia del DELETE (que lo quita
// del viaje y cierra el trip en Copeland), esto SOLO lo marca deshabilitado:
// deja de leer/promediar/alertar en AgroTrack pero conserva asignado=true,
// viaje_id y todo su historial. NO toca Copeland (el trip sigue abierto). El
// termógrafo sigue apareciendo en el detalle con estado "Deshabilitado" y no se
// puede reactivar desde AgroTrack. Solo master/operador.
export async function PATCH(
  _req: Request,
  { params }: { params: { id: string; termografoId: string } }
) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = profile?.role ?? "master";
  if (role !== "master" && role !== "operador") {
    return NextResponse.json({ error: "Sin permiso para deshabilitar termógrafos" }, { status: 403 });
  }

  // Idempotente: solo actúa si estaba asignado a ESTE viaje y aún no deshabilitado.
  const { data: updated } = await supabase
    .from("termografos")
    .update({ deshabilitado: true })
    .eq("id", params.termografoId)
    .eq("viaje_id", params.id)
    .eq("asignado", true)
    .eq("deshabilitado", false)
    .select("id");

  if (updated && updated.length > 0) {
    await logAudit(supabase, {
      viaje_id: params.id,
      tipo: "MODIFICACION",
      descripcion: `Deshabilitó termógrafo ${params.termografoId}`,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; termografoId: string } }
) {
  const supabase = createServerSupabase();

  const { data: viaje } = await supabase
    .from("viajes")
    .select("numero")
    .eq("id", params.id)
    .single();

  closeTrip(
    copelandTripId(viaje?.numero ?? params.id, params.termografoId),
    params.termografoId
  ).catch(() => {});

  const { data: removed } = await supabase
    .from("termografos")
    .update({ asignado: false, viaje_id: null })
    .eq("id", params.termografoId)
    .eq("viaje_id", params.id)
    .select("id");

  // Solo registrar si efectivamente se quitó del viaje (evita ruido si ya no estaba).
  if (removed && removed.length > 0) {
    await logAudit(supabase, {
      viaje_id: params.id,
      tipo: "MODIFICACION",
      descripcion: `Quitó termógrafo ${params.termografoId}`,
    });
  }

  return NextResponse.json({ ok: true });
}
