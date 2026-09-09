import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { moverTrackerDeViaje } from "@/lib/copelandTrip";
import { runSync } from "@/lib/sync";
import { logAudit } from "@/lib/audit";
import { ponerOVsEnTransitoAlAsignar } from "@/lib/termografo";

// Estas rutas hablan con Copeland (cerrar/definir trips, con reintentos), así que
// necesitan más margen que el default de ejecución.
export const maxDuration = 60;

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

  // De qué viaje viene el tracker (si venía de alguno). Se lee ANTES del upsert
  // porque es el trip que hay que cerrar en Copeland; si no, queda amarrado al
  // viaje anterior y deja de reportar cuando ese viaje termina.
  const { data: previo } = await supabase
    .from("termografos")
    .select("viaje_id")
    .eq("id", id)
    .maybeSingle();
  const viajePrevioId = (previo?.viaje_id as string | null) ?? null;

  await supabase.from("termografos").upsert(
    { id, asignado: true, viaje_id: params.id },
    { onConflict: "id" }
  );

  await logAudit(supabase, {
    viaje_id: params.id,
    tipo: "MODIFICACION",
    descripcion: `Asignó termógrafo ${id}`,
  });

  // Si es el primer termógrafo del viaje, las cargas pre-tránsito pasan a En tránsito.
  await ponerOVsEnTransitoAlAsignar(supabase, params.id, [id]);

  // Mover el tracker a este viaje en Copeland: cierra el trip anterior (si traía
  // uno) y define el nuevo, con reintentos. Se espera a que termine —son unos
  // segundos— porque hacerlo en segundo plano fue justo lo que dejó fallos
  // invisibles: en serverless la instancia se congela al responder.
  await moverTrackerDeViaje(
    supabase,
    id,
    viajePrevioId && viajePrevioId !== params.id ? viajePrevioId : null,
    params.id
  );

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
