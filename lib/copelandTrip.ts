/**
 * Capa de trips de Copeland: asignar, mover y re-sincronizar termógrafos.
 *
 * Existe por lo que pasó con el viaje #0282. Al intercambiar dos termógrafos entre
 * viajes, las llamadas a Copeland salieron con segundos de diferencia, se toparon
 * con el rate limit (ErrorCode 1011), y ambos DefineTrip fueron rechazados. Nadie
 * se enteró porque los fallos se escribían en un console.error y `closeTrip` ni
 * siquiera leía la respuesta. Los dos equipos quedaron rastreando su viaje anterior
 * y dejaron de reportar cuando ESE viaje terminó, con el camión todavía en ruta.
 *
 * Lo que arregla esta capa:
 *  - Reintenta cuando Copeland responde rate limit o "tracker ya asignado".
 *  - Cierra el trip anterior ANTES de definir el nuevo, y verifica que cerró.
 *  - Deja constancia en la auditoría del viaje cuando algo falla de verdad, para
 *    que se vea el mismo día en vez de descubrirse por un camión sin señal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTrip, closeTrip, copelandTripId, inicioDeDiaUTC, finDeDiaUTC } from "@/lib/copeland";
import { logAudit } from "@/lib/audit";

// Backoff acotado: 1.5s y 3s entre intentos, o sea 4.5s como peor caso por
// tracker. Se mantiene corto a propósito porque estas rutas corren en serverless
// con límite de ejecución. Si aun así Copeland rechaza, el fallo ya no se pierde:
// queda en la auditoría del viaje.
const INTENTOS = 3;
const ESPERA_MS = 1500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Copeland rechaza el tracker si sigue amarrado a otro trip. Se reintenta igual que un rate limit. */
function esReintentable(r: { rateLimited?: boolean; error?: string }): boolean {
  if (r.rateLimited) return true;
  const e = (r.error ?? "").toLowerCase();
  return e.includes("already assigned") || e.includes("cannot change tracker");
}

type DatosViaje = {
  id: string;
  numero: number;
  lugar_inicio: string;
  lugar_fin: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

async function cargarViaje(supabase: SupabaseClient, viajeId: string): Promise<DatosViaje | null> {
  const { data } = await supabase
    .from("viajes")
    .select("id, numero, lugar_inicio, lugar_fin, fecha_inicio, fecha_fin")
    .eq("id", viajeId)
    .maybeSingle();
  return (data as DatosViaje) ?? null;
}

/** Termógrafos que siguen activos en el viaje (los deshabilitados no rastrean). */
async function trackersActivos(supabase: SupabaseClient, viajeId: string): Promise<string[]> {
  const { data } = await supabase
    .from("termografos")
    .select("id")
    .eq("viaje_id", viajeId)
    .eq("asignado", true)
    .eq("deshabilitado", false);
  return (data ?? []).map((t) => t.id as string);
}

/**
 * Define (o actualiza) el trip de un tracker, reintentando ante rate limit o
 * "tracker ya asignado". Reemitir con el mismo TripID actualiza el trip existente
 * en vez de duplicarlo, así que es seguro repetir.
 */
export async function definirTripConReintento(
  viaje: DatosViaje,
  trackerId: string
): Promise<{ success: boolean; error?: string }> {
  const tripId = copelandTripId(viaje.numero, trackerId);

  for (let intento = 1; intento <= INTENTOS; intento++) {
    const r = await defineTrip({
      tripId,
      trackerId,
      originName: viaje.lugar_inicio,
      destinationName: viaje.lugar_fin,
      scheduledStartUTC: inicioDeDiaUTC(viaje.fecha_inicio),
      scheduledEndUTC: finDeDiaUTC(viaje.fecha_fin),
    });
    if (r.success) return { success: true };
    if (intento < INTENTOS && esReintentable(r)) {
      await dormir(ESPERA_MS * intento);
      continue;
    }
    return { success: false, error: r.error };
  }
  return { success: false, error: "sin intentos restantes" };
}

/**
 * Mueve un tracker de un viaje a otro: cierra el trip anterior, verifica que cerró,
 * y define el nuevo. Es la operación que fallaba en silencio.
 *
 * `viajeOrigen` puede venir null cuando el tracker no traía viaje previo.
 */
export async function moverTrackerDeViaje(
  supabase: SupabaseClient,
  trackerId: string,
  viajeOrigenId: string | null,
  viajeDestinoId: string
): Promise<{ success: boolean; error?: string }> {
  if (viajeOrigenId) {
    const origen = await cargarViaje(supabase, viajeOrigenId);
    if (origen) {
      const tripViejo = copelandTripId(origen.numero, trackerId);
      for (let intento = 1; intento <= INTENTOS; intento++) {
        const r = await closeTrip(tripViejo, trackerId);
        if (r.success) break;
        if (intento < INTENTOS && esReintentable(r)) {
          await dormir(ESPERA_MS * intento);
          continue;
        }
        // Si el trip viejo no cerró, el DefineTrip siguiente va a ser rechazado.
        // Se registra y se intenta de todos modos: el reintento del define puede
        // alcanzar a que Copeland lo libere por su cuenta.
        await registrarFallo(
          supabase,
          viajeDestinoId,
          `No se pudo cerrar el trip anterior del termógrafo ${trackerId} (viaje #${String(
            origen.numero
          ).padStart(4, "0")}): ${r.error ?? "error desconocido"}`
        );
        break;
      }
    }
  }

  const destino = await cargarViaje(supabase, viajeDestinoId);
  if (!destino) return { success: false, error: "viaje destino no encontrado" };

  const r = await definirTripConReintento(destino, trackerId);
  if (!r.success) {
    await registrarFallo(
      supabase,
      viajeDestinoId,
      `Copeland rechazó el rastreo del termógrafo ${trackerId}: ${r.error ?? "error desconocido"}. ` +
        `El equipo puede seguir reportando bajo su viaje anterior.`
    );
  }
  return r;
}

/**
 * Reemite el trip de todos los termógrafos activos de un viaje. Se usa cuando
 * cambian los datos que Copeland necesita: ruta (origen/destino) o rango de fechas.
 * Antes solo se reemitía al cambiar de termógrafo, así que corregir el destino
 * después de asignarlo dejaba a Copeland midiendo contra la ciudad anterior.
 */
export async function sincronizarTripsDeViaje(
  supabase: SupabaseClient,
  viajeId: string
): Promise<void> {
  const viaje = await cargarViaje(supabase, viajeId);
  if (!viaje) return;

  const trackers = await trackersActivos(supabase, viajeId);
  if (trackers.length === 0) return;

  for (const trackerId of trackers) {
    const r = await definirTripConReintento(viaje, trackerId);
    if (!r.success) {
      await registrarFallo(
        supabase,
        viajeId,
        `No se pudo actualizar el rastreo del termógrafo ${trackerId} en Copeland: ${
          r.error ?? "error desconocido"
        }`
      );
    }
  }
}

/** Deja el fallo en la auditoría del viaje, visible, en vez de en un console.error. */
async function registrarFallo(supabase: SupabaseClient, viajeId: string, descripcion: string) {
  console.error(`[Copeland] ${descripcion}`);
  try {
    await logAudit(supabase, { viaje_id: viajeId, tipo: "MODIFICACION", descripcion });
  } catch {
    // La auditoría no debe tumbar la operación del usuario.
  }
}
