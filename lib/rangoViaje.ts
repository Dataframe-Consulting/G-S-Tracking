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
