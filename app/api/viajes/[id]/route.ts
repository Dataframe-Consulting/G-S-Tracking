import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { defineTrip, closeTrip, copelandTripId } from "@/lib/copeland";
import { logAuditMany } from "@/lib/audit";

const VIAJE_FIELD_LABELS: Record<string, string> = {
  lugar_inicio: "lugar de inicio",
  lugar_fin: "lugar de fin",
  fecha_inicio: "fecha de inicio",
  fecha_fin: "fecha de fin",
  flete_cargo: "transportista",
  responsable_id: "responsable",
  termografo_id: "termógrafo",
};

function fmt(value: unknown): string {
  if (value == null || value === "") return "(vacío)";
  return String(value);
}

async function resolveResponsable(
  supabase: SupabaseClient,
  id: string | null | undefined
): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("nombre, email")
    .eq("user_id", id)
    .maybeSingle();
  return data?.nombre ?? data?.email ?? id;
}

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
    .select(
      "termografo_id, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin, flete_cargo, responsable_id, numero"
    )
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
    "linea_transportista_id",
    "operador",
    "modelo",
    "anio",
    "placas_tracto",
    "placas_caja",
    "contacto_unidad",
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
      await closeTrip(copelandTripId(prev?.numero ?? params.id, oldTrackerId), oldTrackerId);
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
        tripId: copelandTripId(prev?.numero ?? params.id, newTrackerId),
        trackerId: newTrackerId,
        originName: lugarInicio,
        destinationName: lugarFin,
        scheduledStartUTC: fechaInicio ? `${fechaInicio}T00:00:00` : null,
        scheduledEndUTC: fechaFin ? `${fechaFin}T23:59:59` : null,
      })
        .then((r) => {
          if (!r.success) console.error("DefineTrip rechazado:", r.error);
        })
        .catch((e) => console.error("DefineTrip error:", e));
    }
  }

  // Auditoría: una entrada por campo que realmente cambió
  if (prev) {
    const descripciones: string[] = [];
    for (const campo of Object.keys(VIAJE_FIELD_LABELS)) {
      if (!(campo in body)) continue;
      const antes = (prev as Record<string, unknown>)[campo] ?? null;
      const despues = (data as Record<string, unknown>)[campo] ?? null;
      if (antes === despues) continue;

      const label = VIAJE_FIELD_LABELS[campo];
      if (campo === "responsable_id") {
        const [nombreAntes, nombreDespues] = await Promise.all([
          resolveResponsable(supabase, antes as string | null),
          resolveResponsable(supabase, despues as string | null),
        ]);
        descripciones.push(`Cambió ${label} de ${fmt(nombreAntes)} a ${fmt(nombreDespues)}`);
      } else {
        descripciones.push(`Cambió ${label} de ${fmt(antes)} a ${fmt(despues)}`);
      }
    }
    await logAuditMany(supabase, { viaje_id: params.id, tipo: "MODIFICACION" }, descripciones);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: prev } = await supabase
    .from("viajes")
    .select("termografo_id, numero")
    .eq("id", params.id)
    .single();

  const { error } = await supabase.from("viajes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (prev?.termografo_id) {
    closeTrip(copelandTripId(prev.numero ?? params.id, prev.termografo_id), prev.termografo_id).catch(() => {});
    await supabase
      .from("termografos")
      .update({ asignado: false, viaje_id: null })
      .eq("id", prev.termografo_id);
  }

  return NextResponse.json({ ok: true });
}
