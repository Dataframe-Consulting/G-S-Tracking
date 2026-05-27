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
