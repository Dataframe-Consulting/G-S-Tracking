import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { closeTrip } from "@/lib/copeland";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; termografoId: string } }
) {
  const supabase = createServerSupabase();

  closeTrip(params.id, params.termografoId).catch(() => {});

  await supabase
    .from("termografos")
    .update({ asignado: false, viaje_id: null })
    .eq("id", params.termografoId)
    .eq("viaje_id", params.id);

  return NextResponse.json({ ok: true });
}
