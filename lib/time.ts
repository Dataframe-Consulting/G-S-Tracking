// Convierte una hora en formato 24h ("HH:MM") al formato display 12h ("6:00 AM").
// Si recibe un formato legado (ej. "6AM", "5am") lo devuelve tal cual.
// Si recibe null/empty/inválido devuelve null.

export function to12h(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!match) return s;

  const h24 = Number(match[1]);
  const m = match[2];
  if (Number.isNaN(h24) || h24 < 0 || h24 > 23) return s;

  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m} ${period}`;
}
