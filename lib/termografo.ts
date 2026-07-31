import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_LABELS, type Status } from "./types";
import { logAuditMany, STATUS_CHANGE_AUDIT_PREFIX } from "./audit";

// Estatus "pre-tránsito": una carga aquí aún no ha salido. Al asignarse el primer
// termógrafo del viaje, estas pasan a En tránsito.
const PRE_TRANSITO: Status[] = ["PENDIENTE", "EN_PREPARACION"];

/**
 * Al asignar el PRIMER termógrafo de un viaje, sus cargas pre-tránsito
 * (Pendiente de carga / Proceso de carga) pasan a En tránsito. Si el viaje ya
 * tenía otro termógrafo asignado, no se toca ningún status (agregar termógrafos
 * adicionales no reabre ni cambia el estado de las cargas). Las cargas ya
 * entregadas, rechazadas o en tránsito no se modifican.
 *
 * `idsAsignadosAhora` = termógrafos que se acaban de asignar en esta operación
 * (uno en asignación normal; varios en una transferencia por rechazo). Se usan
 * para distinguir si el viaje YA tenía termógrafos antes de esta operación.
 */
export async function ponerOVsEnTransitoAlAsignar(
  supabase: SupabaseClient,
  viajeId: string,
  idsAsignadosAhora: string[]
): Promise<void> {
  const { data: asignados } = await supabase
    .from("termografos")
    .select("id")
    .eq("viaje_id", viajeId)
    .eq("asignado", true);

  const previos = (asignados ?? []).filter(
    (t) => !idsAsignadosAhora.includes(t.id as string)
  );
  if (previos.length > 0) return; // el viaje ya tenía termógrafo → no cambiar status

  const { data: pre } = await supabase
    .from("ordenes_venta")
    .select("id, ov_ref, status")
    .eq("viaje_id", viajeId)
    .in("status", PRE_TRANSITO);
  if (!pre || pre.length === 0) return;

  await supabase
    .from("ordenes_venta")
    .update({ status: "TRANSITO", updated_at: new Date().toISOString() })
    .eq("viaje_id", viajeId)
    .in("status", PRE_TRANSITO);

  // Auditoría por carga, con el prefijo estándar de cambio de status.
  const descripciones = pre.map(
    (o) =>
      `${STATUS_CHANGE_AUDIT_PREFIX} ${o.ov_ref ?? "(sin ref)"} de ${STATUS_LABELS[o.status as Status]} a ${STATUS_LABELS.TRANSITO}`
  );
  await logAuditMany(supabase, { viaje_id: viajeId, tipo: "MODIFICACION" }, descripciones);
}
