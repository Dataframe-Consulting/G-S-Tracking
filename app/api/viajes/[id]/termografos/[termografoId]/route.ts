import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { closeTrip, copelandTripId } from "@/lib/copeland";

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

  await supabase
    .from("termografos")
    .update({ asignado: false, viaje_id: null })
    .eq("id", params.termografoId)
    .eq("viaje_id", params.id);

  return NextResponse.json({ ok: true });
}
