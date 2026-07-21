import type { Status } from "./types";

// Status que "cierran" una carga y congelan el monitoreo del viaje: entregada o
// rechazada. Congelar = el sync deja de pedir lecturas y de evaluar alertas para
// ese viaje y apaga su alerta_activa. NO cierra el trip en Copeland (igual que un
// viaje entregado): el trip queda abierto, solo se ignora del lado de AgroTrack.
export const STATUS_TERMINALES: Status[] = ["ENTREGADO", "RECHAZO_CALIDAD"];

/**
 * Un viaje está "concluido" (monitoreo congelado) cuando tiene al menos una OV
 * y TODAS sus OVs están en un status terminal (entregada o rechazada). Si
 * cualquiera sigue en proceso, el viaje se monitorea normal. Se recalcula en
 * cada sync, así que cualquier cambio de status reactiva el monitoreo.
 */
export function viajeConcluido(
  ordenes: Array<{ status: Status }> | null | undefined
): boolean {
  if (!ordenes || ordenes.length === 0) return false;
  return ordenes.every((o) => STATUS_TERMINALES.includes(o.status));
}
