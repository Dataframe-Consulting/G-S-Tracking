import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { defineTrip, copelandTripId } from "@/lib/copeland";
import { runSync } from "@/lib/sync";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { termografo_id } = await req.json();

  if (!termografo_id?.trim()) {
    return NextResponse.json({ error: "termografo_id requerido" }, { status: 400 });
  }

  const id = termografo_id.trim();

  // Check if this thermograph is already assigned to a different viaje
  const { data: existing } = await supabase
    .from("termografos")
    .select("id, viaje_id, asignado")
    .eq("id", id)
    .maybeSingle();

  if (existing?.asignado && existing.viaje_id && existing.viaje_id !== params.id) {
    return NextResponse.json(
      { error: "Este termógrafo ya está asignado a otro viaje" },
      { status: 400 }
    );
  }

  // If already assigned to THIS viaje, no-op
  if (existing?.asignado && existing.viaje_id === params.id) {
    const { data: termografos } = await supabase
      .from("termografos")
      .select("*")
      .eq("viaje_id", params.id)
      .eq("asignado", true);
    return NextResponse.json({ termografos: termografos ?? [] });
  }

  const { data: viaje } = await supabase
    .from("viajes")
    .select("id, numero, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin")
    .eq("id", params.id)
    .single();

  if (!viaje) return NextResponse.json({ error: "Viaje no encontrado" }, { status: 404 });

  await supabase.from("termografos").upsert(
    { id, asignado: true, viaje_id: params.id },
    { onConflict: "id" }
  );

  await logAudit(supabase, {
    viaje_id: params.id,
    tipo: "MODIFICACION",
    descripcion: `Asignó termógrafo ${id}`,
  });

  defineTrip({
    tripId: copelandTripId(viaje.numero, id),
    trackerId: id,
    originName: viaje.lugar_inicio,
    destinationName: viaje.lugar_fin,
    scheduledStartUTC: viaje.fecha_inicio ? `${viaje.fecha_inicio}T00:00:00` : null,
    scheduledEndUTC: viaje.fecha_fin ? `${viaje.fecha_fin}T23:59:59` : null,
  })
    .then((r) => {
      if (!r.success) console.error("DefineTrip rechazado:", r.error);
    })
    .catch((e) => console.error("DefineTrip error:", e));

  // Backfill: jala de inmediato las lecturas del termógrafo recién asignado,
  // sin depender del cursor global del cron (evita perder lecturas previas a la
  // asignación). El dedup en persistMultipleReadings evita duplicados.
  try {
    await runSync(supabase, params.id);
  } catch (e) {
    console.error("Backfill sync error:", e);
  }

  const { data: termografos } = await supabase
    .from("termografos")
    .select("*")
    .eq("viaje_id", params.id)
    .eq("asignado", true);

  return NextResponse.json({ termografos: termografos ?? [] });
}
