import type { Status } from "./types";

// Status que cuenta como entrega final. Solo "Entregado" congela el monitoreo.
// (Rechazo NO es terminal: la carga sigue activa / trayecto en curso.)
export const STATUS_TERMINAL: Status = "ENTREGADO";

/**
 * Un viaje está "concluido" (monitoreo congelado) cuando tiene al menos una OV
 * y TODAS sus OVs están en Entregado. Si cualquiera está en otro status, el
 * viaje sigue activo y se monitorea normal. Se recalcula en cada sync, así que
 * cualquier cambio de status reactiva el monitoreo automáticamente.
 */
export function viajeConcluido(
  ordenes: Array<{ status: Status }> | null | undefined
): boolean {
  if (!ordenes || ordenes.length === 0) return false;
  return ordenes.every((o) => o.status === STATUS_TERMINAL);
}
