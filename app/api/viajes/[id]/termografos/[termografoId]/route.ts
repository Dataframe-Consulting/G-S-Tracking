import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { closeTrip, copelandTripId } from "@/lib/copeland";
import { logAudit } from "@/lib/audit";

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
