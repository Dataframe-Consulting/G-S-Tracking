import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { defineTrip, closeTrip } from "@/lib/copeland";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("viajes")
    .select(`*, responsable:user_profiles!responsable_id(id, nombre, email), ordenes_venta ( *, produto:productos(id, nombre, temp_min, temp_max), combo:produto_combinaciones!produto_combinacion_id(id, temp_min, temp_max, produto_a:productos!produto_a_id(id, nombre), produto_b:productos!produto_b_id(id, nombre)) )`)
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data: prev } = await supabase
    .from("viajes")
    .select("termografo_id, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin, numero")
    .eq("id", params.id)
    .single();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "lugar_inicio",
    "lugar_fin",
    "fecha_inicio",
    "fecha_fin",
    "flete_cargo",
    "termografo_id",
    "responsable_id",
  ];
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await supabase
    .from("viajes")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Manejar cambio de termógrafo
  if ("termografo_id" in body && body.termografo_id !== prev?.termografo_id) {
    const oldTrackerId = prev?.termografo_id ?? null;
    const newTrackerId = body.termografo_id ?? null;

    // Desasignar el anterior: cerrar trip en Copeland + actualizar DB
    if (oldTrackerId) {
      await closeTrip(params.id, oldTrackerId);
      await supabase
        .from("termografos")
        .update({ asignado: false, viaje_id: null })
        .eq("id", oldTrackerId);
    }

    // Asignar el nuevo: upsert en DB (crea si el serial no existe) + DefineTrip en Copeland
    if (newTrackerId) {
      await supabase.from("termografos").upsert(
        { id: newTrackerId, asignado: true, viaje_id: data.id },
        { onConflict: "id" }
      );

      // Usar datos del viaje actualizado para DefineTrip
      const lugarInicio = (update.lugar_inicio as string | undefined) ?? prev?.lugar_inicio ?? "";
      const lugarFin = (update.lugar_fin as string | undefined) ?? prev?.lugar_fin ?? "";
      const fechaInicio = (update.fecha_inicio as string | undefined) ?? prev?.fecha_inicio;
      const fechaFin = (update.fecha_fin as string | undefined) ?? prev?.fecha_fin;

      // DefineTrip es best-effort: no bloqueamos si falla
      defineTrip({
        tripId: params.id,
        trackerId: newTrackerId,
        originName: lugarInicio,
        destinationName: lugarFin,
        scheduledStartUTC: fechaInicio ? `${fechaInicio}T00:00:00` : null,
        scheduledEndUTC: fechaFin ? `${fechaFin}T23:59:59` : null,
      }).catch((e) => console.error("DefineTrip error:", e));
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: prev } = await supabase
    .from("viajes")
    .select("termografo_id")
    .eq("id", params.id)
    .single();

  const { error } = await supabase.from("viajes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (prev?.termografo_id) {
    closeTrip(params.id, prev.termografo_id).catch(() => {});
    await supabase
      .from("termografos")
      .update({ asignado: false, viaje_id: null })
      .eq("id", prev.termografo_id);
  }

  return NextResponse.json({ ok: true });
}
