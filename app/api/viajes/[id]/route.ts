import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { defineTrip, closeTrip, copelandTripId } from "@/lib/copeland";
import { logAuditMany } from "@/lib/audit";
import { cToF } from "@/lib/temperature";
import { ponerOVsEnTransitoAlAsignar } from "@/lib/termografo";

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

// El rango se guarda en °C (como productos/lecturas); en auditoría se muestra en °F.
function rangoLabel(min: unknown, max: unknown): string {
  if (min == null || max == null) return "(sin rango)";
  const f = (v: unknown) => (cToF(Number(v)) as number).toFixed(0);
  return `${f(min)}–${f(max)}°F`;
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
    .select(`*, responsable:user_profiles!responsable_id(id, nombre, email), ordenes_venta ( *, productos:orden_productos(id, producto_id, cajas, producto:productos(id, nombre)) )`)
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
      "termografo_id, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin, flete_cargo, responsable_id, numero, temp_min, temp_max"
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
    "temp_min",
    "temp_max",
    "temp_rango_id",
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

      // Si es el primer termógrafo del viaje, las cargas pre-tránsito pasan a En tránsito.
      await ponerOVsEnTransitoAlAsignar(supabase, params.id, [newTrackerId]);

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
    // Rango de temperatura del viaje (min+max como una sola unidad, mostrado en °F)
    if ("temp_min" in body || "temp_max" in body) {
      const eq = (a: unknown, b: unknown) =>
        (a == null && b == null) || Number(a) === Number(b);
      if (!eq(prev.temp_min, data.temp_min) || !eq(prev.temp_max, data.temp_max)) {
        descripciones.push(
          `Cambió rango de temperatura de ${rangoLabel(prev.temp_min, prev.temp_max)} a ${rangoLabel(data.temp_min, data.temp_max)}`
        );
      }
    }

    await logAuditMany(supabase, { viaje_id: params.id, tipo: "MODIFICACION" }, descripciones);
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  // Solo master u operador pueden eliminar viajes (visor no).
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
    return NextResponse.json({ error: "Sin permiso para eliminar viajes" }, { status: 403 });
  }

  const { data: prev } = await supabase
    .from("viajes")
    .select("numero, termografo_id")
    .eq("id", params.id)
    .single();

  // Desasignar TODOS los termógrafos del viaje (modelo multi) y cerrar sus trips en
  // Copeland. El FK termografos.viaje_id NO tiene cascade: si no se desasignan, el
  // borrado falla. Se incluye el campo legacy viajes.termografo_id por si quedó alguno.
  const { data: termos } = await supabase
    .from("termografos")
    .select("id")
    .eq("viaje_id", params.id);

  const termoIds = new Set<string>((termos ?? []).map((t) => t.id as string));
  if (prev?.termografo_id) termoIds.add(prev.termografo_id);
  for (const tid of termoIds) {
    closeTrip(copelandTripId(prev?.numero ?? params.id, tid), tid).catch(() => {});
  }
  if (termos && termos.length > 0) {
    await supabase
      .from("termografos")
      .update({ asignado: false, viaje_id: null })
      .eq("viaje_id", params.id);
  }

  // Cascada en BD: OVs, lecturas, alertas e historial de auditoría se borran solos.
  const { error } = await supabase.from("viajes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
