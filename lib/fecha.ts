// Formato único de fechas para toda la plataforma: DD/MM/AAAA.
// Las columnas `date` de Supabase llegan como "AAAA-MM-DD" y los timestamps
// como ISO completo. Estos helpers son la única fuente de verdad para mostrar fechas.

/** "AAAA-MM-DD" (o ISO) → "DD/MM/AAAA". Devuelve "" si viene vacío. */
export function formatFecha(s?: string | null): string {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

/** Timestamp ISO → "DD/MM/AAAA, HH:mm" (24h). Devuelve "" si viene vacío. */
export function formatFechaHora(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
