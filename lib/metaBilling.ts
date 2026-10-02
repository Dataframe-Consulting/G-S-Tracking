/**
 * Costos de WhatsApp según Meta (Graph API).
 *
 * Meta cobra POR MENSAJE ENTREGADO, no por mensaje enviado:
 *   "You are only charged when a template message is delivered."
 *
 * La diferencia no es teórica. En septiembre 2026 AgroTrack envió 7,498 mensajes
 * y Meta solo entregó 5,255 — el resto se aceptó pero nunca salió, por el bloqueo
 * de la cuenta por adeudo. Facturar sobre nuestro conteo habría cobrado $1,173
 * cuando el cargo real fue $822. Por eso el número que manda es el de Meta.
 *
 * Meta NO expone por API si una factura está pagada: se probaron `invoices`,
 * `billing`, `transactions` y el funding source, y ninguno existe o da permiso.
 * El estado de pago se marca a mano desde la UI.
 *
 * Env vars:
 *   WHATSAPP_TOKEN    — necesita el permiso whatsapp_business_management
 *   WHATSAPP_WABA_ID  — id de la cuenta de WhatsApp Business
 */

const GRAPH_VERSION = "v20.0";

/** La cuenta de Meta está en America/Phoenix (UTC−7, sin horario de verano),
 *  igual que Sonora. Los meses se cortan en esa zona, no en UTC: con ese corte
 *  nuestro conteo de agosto cuadró exacto contra Meta (6,290 = 6,290). */
const OFFSET_HORAS = 7;

export type PeriodoMeta = {
  /** 'AAAA-MM' */
  periodo: string;
  /** Mensajes entregados y cobrables, según Meta. */
  mensajes: number;
  /** Costo real en la moneda de la cuenta (MXN). */
  costo: number;
  /** Mensajes que Meta registra como enviados. */
  enviados: number;
};

/** Inicio del mes en hora de Sonora, como epoch en segundos. */
export function inicioMesEpoch(periodo: string): number {
  const [y, m] = periodo.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, 1, OFFSET_HORAS, 0, 0) / 1000);
}

/** Inicio del mes siguiente, para usarlo como fin exclusivo. */
export function finMesEpoch(periodo: string): number {
  const [y, m] = periodo.split("-").map(Number);
  return Math.floor(Date.UTC(y, m, 1, OFFSET_HORAS, 0, 0) / 1000);
}

/** 'AAAA-MM' del epoch, en hora de Sonora. */
function periodoDeEpoch(epoch: number): string {
  const d = new Date((epoch - OFFSET_HORAS * 3600) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function graphGet(path: string): Promise<Record<string, unknown>> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("Falta WHATSAPP_TOKEN");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as Record<string, unknown>;
  const error = json.error as { message?: string; code?: number } | undefined;
  if (error) {
    throw new Error(`Meta (${error.code ?? "?"}): ${error.message ?? "error desconocido"}`);
  }
  return json;
}

type PricingPoint = { start: number; end: number; volume?: number; cost?: number };
type AnalyticsPoint = { start: number; end: number; sent?: number; delivered?: number };

/**
 * Costo y volumen por mes, desde `desde` hasta hoy. Devuelve un periodo por mes
 * con lo que Meta efectivamente entregó y cobró.
 */
export async function obtenerCostosMeta(desde: string): Promise<PeriodoMeta[]> {
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!waba) throw new Error("Falta WHATSAPP_WABA_ID");

  const start = inicioMesEpoch(desde);
  // Fin: inicio del mes siguiente al actual, para incluir el mes en curso.
  const hoy = new Date();
  const finPeriodo = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, "0")}`;
  const end = finMesEpoch(finPeriodo);

  const [pricing, analytics] = await Promise.all([
    graphGet(
      `/${waba}?fields=pricing_analytics.start(${start}).end(${end})` +
        `.granularity(MONTHLY).dimensions(["PRICING_CATEGORY"])`
    ),
    graphGet(`/${waba}?fields=analytics.start(${start}).end(${end}).granularity(MONTH)`),
  ]);

  // pricing_analytics: puede traer varias categorías por mes (UTILITY, MARKETING…),
  // así que se suman todas las del mismo periodo.
  const porPeriodo = new Map<string, PeriodoMeta>();

  const pa = pricing.pricing_analytics as { data?: Array<{ data_points?: PricingPoint[] }> } | undefined;
  for (const bloque of pa?.data ?? []) {
    for (const p of bloque.data_points ?? []) {
      const periodo = periodoDeEpoch(p.start);
      const acc = porPeriodo.get(periodo) ?? { periodo, mensajes: 0, costo: 0, enviados: 0 };
      acc.mensajes += p.volume ?? 0;
      acc.costo += p.cost ?? 0;
      porPeriodo.set(periodo, acc);
    }
  }

  const an = analytics.analytics as { data_points?: AnalyticsPoint[] } | undefined;
  for (const p of an?.data_points ?? []) {
    const periodo = periodoDeEpoch(p.start);
    const acc = porPeriodo.get(periodo) ?? { periodo, mensajes: 0, costo: 0, enviados: 0 };
    acc.enviados = p.sent ?? 0;
    // Si pricing_analytics no respondió (p. ej. cuentas con línea de crédito
    // compartida), al menos se conserva el volumen entregado.
    if (acc.mensajes === 0) acc.mensajes = p.delivered ?? 0;
    porPeriodo.set(periodo, acc);
  }

  return Array.from(porPeriodo.values())
    .map((p) => ({ ...p, costo: Math.round(p.costo * 100) / 100 }))
    .sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
}
