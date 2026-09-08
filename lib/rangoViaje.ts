/**
 * Rango operativo del viaje, derivado de sus cargas.
 *
 *   fecha_inicio = MIN(fecha_carga)   de todas las OVs del viaje
 *   fecha_fin    = MAX(fecha_entrega) de todas las OVs del viaje
 *
 * Se recalcula desde los cinco puntos que mueven cargas: alta, edición y baja de
 * OV, más los dos inserts del rechazo. Las escrituras que solo cambian `status`
 * no lo llaman porque no mueven fechas.
 *
 * Dos reglas que no se negocian:
 *  - Los viajes con `fechas_automaticas = false` (todo lo anterior a la
 *    migración 025) nunca se tocan, ni aunque alguien edite una de sus cargas.
 *  - Sin dato se escribe NULL. Nunca una fecha inventada ni "hoy": el rango
 *    vacío es información honesta, una fecha falsa no.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTrip, copelandTripId, inicioDeDiaUTC, finDeDiaUTC } from "@/lib/copeland";

export type RangoViaje = {
  /** true si el rango realmente cambió de valor y se persistió. */
  cambio: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Datos del viaje que necesita quien decide si re-notificar a Copeland. */
  viaje?: {
    id: string;
    numero: number;
    lugar_inicio: string;
    lugar_fin: string;
  };
};

const SIN_CAMBIO: RangoViaje = { cambio: false, fecha_inicio: null, fecha_fin: null };

/**
 * Recalcula y persiste el rango de un viaje. Devuelve `cambio: false` cuando el
 * viaje está congelado, no existe, o el rango calculado es idéntico al guardado
 * — así quien llama sabe si vale la pena avisarle a Copeland.
 */
export async function recalcularRangoViaje(
  supabase: SupabaseClient,
  viajeId: string
): Promise<RangoViaje> {
  const { data: viaje } = await supabase
    .from("viajes")
    .select("id, numero, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin, fechas_automaticas")
    .eq("id", viajeId)
    .single();

  // Viaje inexistente o congelado: se sale antes de leer nada más.
  if (!viaje || !viaje.fechas_automaticas) return SIN_CAMBIO;

  // TODAS las cargas del viaje. Se consulta por viaje_id directo, sin pasar por
  // las colecciones derivadas del frontend (ovsForTab y compañía filtran por
  // status para las pestañas: son vistas, no el dato).
  const { data: ovs, error } = await supabase
    .from("ordenes_venta")
    .select("fecha_carga, fecha_entrega")
    .eq("viaje_id", viajeId);

  // Ante un error de lectura no se escribe nada: mejor conservar el rango
  // anterior que pisarlo con un cálculo hecho sobre datos incompletos.
  if (error) return SIN_CAMBIO;

  const cargas = (ovs ?? []).map((o) => o.fecha_carga as string | null).filter(Boolean) as string[];
  const entregas = (ovs ?? []).map((o) => o.fecha_entrega as string | null).filter(Boolean) as string[];

  // Las fechas son `date` de Postgres en formato ISO (AAAA-MM-DD), así que el
  // orden lexicográfico coincide con el cronológico.
  const fechaInicio = cargas.length ? cargas.reduce((a, b) => (a < b ? a : b)) : null;
  const fechaFin = entregas.length ? entregas.reduce((a, b) => (a > b ? a : b)) : null;

  if (fechaInicio === viaje.fecha_inicio && fechaFin === viaje.fecha_fin) {
    return { cambio: false, fecha_inicio: fechaInicio, fecha_fin: fechaFin };
  }

  const { error: errUpdate } = await supabase
    .from("viajes")
    .update({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", viajeId);

  if (errUpdate) return SIN_CAMBIO;

  return {
    cambio: true,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    viaje: {
      id: viaje.id as string,
      numero: viaje.numero as number,
      lugar_inicio: viaje.lugar_inicio as string,
      lugar_fin: viaje.lugar_fin as string,
    },
  };
}

// ---------------------------------------------------------------------------
// Sincronización con Copeland
// ---------------------------------------------------------------------------

/**
 * Debounce en memoria por TripID. Evita encadenar llamadas a DefineTrip cuando
 * alguien edita varias cargas del mismo viaje en rápida sucesión, que es como
 * se cae en el rate limit (ErrorCode 1011).
 *
 * Es best-effort a propósito: en serverless cada instancia tiene su propio Map,
 * así que dos ediciones atendidas por instancias distintas no se ven entre sí.
 * Cubre el caso común (ráfagas del mismo usuario, misma instancia caliente) sin
 * meter estado persistente. Si Copeland igual responde 1011, no se pierde nada
 * grave: el trip conserva la ventana anterior y el siguiente cambio de rango
 * vuelve a intentarlo.
 */
const ultimaEmision = new Map<string, number>();
const DEBOUNCE_MS = 60_000;

/**
 * Recalcula el rango del viaje y, si cambió, se lo notifica a Copeland.
 *
 * Copeland es 1 trip = 1 tracker, así que se reemite un DefineTrip por cada
 * termógrafo activo del viaje. Reemitir con el mismo TripID ACTUALIZA el trip
 * existente, no crea uno nuevo:
 *   "Update an existing trip: pass the same TripID with all original fields
 *    plus any updated values." — Copeland EDI API v2, Define Trip
 *
 * Todo el trato con Copeland es best-effort: si falla, la operación del usuario
 * ya quedó guardada y no se bloquea.
 */
export async function sincronizarRangoViaje(
  supabase: SupabaseClient,
  viajeId: string
): Promise<RangoViaje> {
  const rango = await recalcularRangoViaje(supabase, viajeId);
  if (!rango.cambio || !rango.viaje) return rango;

  // Sin termógrafo activo no hay trip que actualizar.
  const { data: termos } = await supabase
    .from("termografos")
    .select("id")
    .eq("viaje_id", viajeId)
    .eq("asignado", true)
    .eq("deshabilitado", false);

  if (!termos?.length) return rango;

  const { numero, lugar_inicio, lugar_fin } = rango.viaje;
  const ahora = Date.now();

  for (const t of termos) {
    const trackerId = t.id as string;
    const tripId = copelandTripId(numero, trackerId);

    const previa = ultimaEmision.get(tripId);
    if (previa && ahora - previa < DEBOUNCE_MS) continue;
    ultimaEmision.set(tripId, ahora);

    defineTrip({
      tripId,
      trackerId,
      originName: lugar_inicio,
      destinationName: lugar_fin,
      scheduledStartUTC: inicioDeDiaUTC(rango.fecha_inicio),
      scheduledEndUTC: finDeDiaUTC(rango.fecha_fin),
    })
      .then((r) => {
        if (r.success) return;
        if (r.rateLimited) {
          // Rate limit: el trip se queda con la ventana anterior hasta el
          // siguiente cambio de rango. Se permite reintentar antes del debounce.
          ultimaEmision.delete(tripId);
          console.warn(`DefineTrip rate-limited (${tripId}), se reintenta al próximo cambio`);
          return;
        }
        console.error(`DefineTrip rechazado (${tripId}):`, r.error);
      })
      .catch((e) => console.error(`DefineTrip error (${tripId}):`, e));
  }

  return rango;
}
