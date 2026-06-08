// Helpers de conversión de temperatura.
// La BD y la API Copeland trabajan en °C; la UI y los mensajes se muestran en °F.

export function cToF(c: number | null | undefined): number | null {
  if (c == null || Number.isNaN(Number(c))) return null;
  return Number(c) * 9 / 5 + 32;
}

export function fToC(f: number | null | undefined): number | null {
  if (f == null || Number.isNaN(Number(f))) return null;
  return (Number(f) - 32) * 5 / 9;
}

// Estado de una lectura respecto al rango permitido del producto.
// Fuente única de verdad para el color de temperatura en toda la plataforma:
//   "alta" → arriba del rango (rojo) · "baja" → debajo (azul) · "ok" → dentro (neutro)
export type TempEstado = "alta" | "baja" | "ok";

export function tempEstado(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): TempEstado {
  if (value == null || min == null || max == null) return "ok";
  if (Number(value) > Number(max)) return "alta";
  if (Number(value) < Number(min)) return "baja";
  return "ok";
}
