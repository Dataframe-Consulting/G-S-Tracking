/**
 * Datos del dashboard y de las vistas de Transportistas y Clientes.
 *
 * Todo se calcula con lecturas: no toca cómo se dan de alta cargas ni viajes.
 *
 * Dos cosas que conviene tener presentes:
 *
 * 1. Las métricas se dividen en dos grupos. Las del bloque "Ahora" NO llevan
 *    filtro de fecha —son el estado presente de la operación— y las del periodo
 *    sí. Antes todas se filtraban por periodo, así que "En tránsito" no reflejaba
 *    el presente si alguien movía el rango de fechas.
 *
 * 2. El día se corta en hora de Sonora, no en UTC. El servidor de Vercel corre en
 *    UTC, así que entre las 17:00 y la medianoche de Sonora "hoy" se adelantaba un
 *    día y el rango por defecto incluía una fecha que aún no empezaba.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Status } from "@/lib/types";

/** Sonora: UTC−7 todo el año, sin horario de verano. */
const OFFSET_SONORA_HORAS = 7;

/** 'AAAA-MM-DD' de hoy en Sonora. */
export function hoySonora(): string {
  const d = new Date(Date.now() - OFFSET_SONORA_HORAS * 3600_000);
  return d.toISOString().slice(0, 10);
}

/** 'AAAA-MM-DD' de hace n días en Sonora. */
export function diasAtrasSonora(n: number): string {
  const d = new Date(Date.now() - OFFSET_SONORA_HORAS * 3600_000 - n * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Instante UTC en que empieza ese día en Sonora. Para filtrar timestamptz.
 *  Sonora es UTC−7, así que la medianoche local son las 07:00 UTC. */
export function inicioDelDiaUTC(fecha: string): string {
  return new Date(`${fecha}T0${OFFSET_SONORA_HORAS}:00:00Z`).toISOString();
}

/** Instante UTC en que termina ese día en Sonora (exclusivo). */
export function finDelDiaUTC(fecha: string): string {
  const d = new Date(`${fecha}T0${OFFSET_SONORA_HORAS}:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

// ---------------------------------------------------------------------------

export type OrdenDashboard = {
  id: string;
  fecha_carga: string;
  cliente: string;
  status: Status;
  ov_ref: string | null;
  viaje: {
    id: string;
    numero: number;
    flete_cargo: string | null;
    linea: { concesionario: { nombre: string } | null } | null;
  } | null;
  orden_productos: { producto_id: string | null; producto: { nombre: string } | null }[];
};

export type Ahora = {
  alertasActivas: number;
  enTransito: number;
  pendienteCarga: number;
  enProceso: number;
};

export type CadenaFrio = {
  /** % de lecturas dentro de rango en el periodo. null si no hubo lecturas. */
  pctEnRango: number | null;
  /** Mediciones de temperatura tomadas en el periodo. */
  lecturas: number;
  /** De esas, cuántas cayeron dentro del rango del producto. */
  enRango: number;
};

/** Desglose que abre el "Ver detalle" de cadena de frío.
 *
 *  Se arma con `alertas_log` y no con `lecturas_temperatura`: agrupar las
 *  decenas de miles de lecturas por transportista exigiría paginar la API
 *  (PostgREST corta en 1000 filas por petición). Las alertas son un buen
 *  sustituto porque cada una representa 30 minutos continuos fuera de rango,
 *  y pesan ~50 KB en un mes. */
export type DetalleFrio = {
  porTransportista: { nombre: string; alertas: number; viajes: number }[];
  viajes: { viajeId: string; numero: number; transportista: string; cliente: string; alertas: number }[];
};

/** Nombre del transportista de una carga: concesionario del catálogo y, si no
 *  tiene, el campo legacy `flete_cargo`. Los nombres coinciden entre ambos, así
 *  que agrupar por nombre une correctamente las dos fuentes. */
export function transportistaDe(o: OrdenDashboard): string {
  const nombre = o.viaje?.linea?.concesionario?.nombre ?? o.viaje?.flete_cargo;
  return nombre?.trim() || "Sin asignar";
}

/** Productos de una carga, sin repetir. */
export function productosDe(o: OrdenDashboard): string[] {
  const vistos = new Set<string>();
  for (const op of o.orden_productos ?? []) {
    const n = op.producto?.nombre?.trim();
    if (n) vistos.add(n);
  }
  return Array.from(vistos);
}

const SELECT_ORDENES = `
  id, fecha_carga, cliente, status, ov_ref,
  viaje:viajes(id, numero, flete_cargo,
    linea:lineas_transportista!linea_transportista_id(
      concesionario:concesionarios!concesionario_id(nombre))),
  orden_productos%JOIN%(producto_id, producto:productos(nombre))
`;

/** Cargas del periodo, con su viaje y productos. Base de todo lo que responde
 *  a los filtros. El filtro de producto usa !inner, que acota las cargas sin
 *  multiplicar filas (PostgREST anida en vez de hacer join cartesiano). */
export async function cargasDelPeriodo(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
  productoId?: string
): Promise<OrdenDashboard[]> {
  const select = SELECT_ORDENES.replace("%JOIN%", productoId ? "!inner" : "");
  let q = supabase
    .from("ordenes_venta")
    .select(select)
    .gte("fecha_carga", desde)
    .lte("fecha_carga", hasta)
    .order("fecha_carga", { ascending: true });

  if (productoId) q = q.eq("orden_productos.producto_id", productoId);

  const { data } = await q;
  return (data ?? []) as unknown as OrdenDashboard[];
}

/** Estado presente de la operación. Sin filtro de fecha, a propósito. */
export async function estadoAhora(supabase: SupabaseClient): Promise<Ahora> {
  const contar = async (tabla: string, col: string, valor: string | boolean) => {
    const { count } = await supabase
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq(col, valor);
    return count ?? 0;
  };

  const [alertasActivas, enTransito, pendienteCarga, enProceso] = await Promise.all([
    contar("viajes", "alerta_activa", true),
    contar("ordenes_venta", "status", "TRANSITO"),
    contar("ordenes_venta", "status", "PENDIENTE"),
    contar("ordenes_venta", "status", "EN_PREPARACION"),
  ]);

  return { alertasActivas, enTransito, pendienteCarga, enProceso };
}

/** Cumplimiento de cadena de frío del periodo. Se cuenta con HEAD para no
 *  traerse las decenas de miles de lecturas al servidor. */
export async function cadenaFrio(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<CadenaFrio> {
  const ini = inicioDelDiaUTC(desde);
  const fin = finDelDiaUTC(hasta);

  const contarLecturas = async (soloEnRango: boolean) => {
    let q = supabase
      .from("lecturas_temperatura")
      .select("id", { count: "exact", head: true })
      .gte("timestamp", ini)
      .lt("timestamp", fin);
    if (soloEnRango) q = q.eq("fuera_rango", false);
    const { count } = await q;
    return count ?? 0;
  };

  const [lecturas, enRango] = await Promise.all([contarLecturas(false), contarLecturas(true)]);

  return {
    lecturas,
    enRango,
    pctEnRango: lecturas > 0 ? Math.round((enRango / lecturas) * 1000) / 10 : null,
  };
}

/**
 * Trae TODOS los `viaje_id` de las alertas del periodo, paginando.
 *
 * Supabase corta cada respuesta en 1000 filas sin importar el `limit` que se
 * pida, así que una sola consulta devolvía 1000 de las ~7,300 alertas de un mes
 * y los conteos salían cortos. Se pagina con `range()` hasta agotar.
 */
export async function alertasDelPeriodo(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<string[]> {
  const PAGINA = 1000;
  const TOPE = 60_000; // ~8 meses de alertas al ritmo actual; corta por seguridad
  const ini = inicioDelDiaUTC(desde);
  const fin = finDelDiaUTC(hasta);
  const out: string[] = [];

  for (let desdeFila = 0; desdeFila < TOPE; desdeFila += PAGINA) {
    const { data, error } = await supabase
      .from("alertas_log")
      .select("viaje_id")
      .gte("created_at", ini)
      .lt("created_at", fin)
      .order("created_at", { ascending: true })
      .range(desdeFila, desdeFila + PAGINA - 1);

    if (error || !data || data.length === 0) break;
    for (const a of data) if (a.viaje_id) out.push(a.viaje_id as string);
    if (data.length < PAGINA) break;
  }
  return out;
}

/** Viajes que tuvieron al menos una alerta. Recibe los ids ya paginados para
 *  no volver a consultarlos: una página los pide una vez y los reusa. */
export function viajesConAlerta(idsAlertas: string[]): Set<string> {
  return new Set(idsAlertas);
}

// ---------------------------------------------------------------------------
// Agregados que comparten el dashboard y las vistas de detalle
// ---------------------------------------------------------------------------

export type FilaAgrupada = {
  nombre: string;
  cargas: number;
  pct: number;
  rechazos: number;
  viajesConAlerta: number;
  /** Cargas por día, en el orden del periodo. Para el sparkline. */
  serie: number[];
  ultimaCarga: string | null;
  productos: string[];
};

/** Lista de días del periodo, en orden. */
export function diasDelPeriodo(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (cur <= fin) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Agrupa las cargas por transportista o por cliente. */
export function agrupar(
  ordenes: OrdenDashboard[],
  por: "transportista" | "cliente",
  viajesConAlerta: Set<string>,
  dias: string[]
): FilaAgrupada[] {
  const idx = new Map(dias.map((d, i) => [d, i]));
  const acc = new Map<
    string,
    {
      cargas: number;
      rechazos: number;
      viajes: Set<string>;
      serie: number[];
      ultima: string | null;
      prods: Map<string, number>;
    }
  >();

  for (const o of ordenes) {
    const clave = por === "transportista" ? transportistaDe(o) : o.cliente?.trim() || "Sin cliente";
    let a = acc.get(clave);
    if (!a) {
      a = {
        cargas: 0,
        rechazos: 0,
        viajes: new Set(),
        serie: new Array(dias.length).fill(0),
        ultima: null,
        prods: new Map(),
      };
      acc.set(clave, a);
    }
    a.cargas++;
    if (o.status === "RECHAZO_CALIDAD") a.rechazos++;
    if (o.viaje?.id && viajesConAlerta.has(o.viaje.id)) a.viajes.add(o.viaje.id);
    const i = idx.get(o.fecha_carga);
    if (i != null) a.serie[i]++;
    if (!a.ultima || o.fecha_carga > a.ultima) a.ultima = o.fecha_carga;
    for (const p of productosDe(o)) a.prods.set(p, (a.prods.get(p) ?? 0) + 1);
  }

  const total = ordenes.length || 1;
  return Array.from(acc.entries())
    .map(([nombre, a]) => ({
      nombre,
      cargas: a.cargas,
      pct: Math.round((a.cargas / total) * 1000) / 10,
      rechazos: a.rechazos,
      viajesConAlerta: a.viajes.size,
      serie: a.serie,
      ultimaCarga: a.ultima,
      productos: Array.from(a.prods.entries())
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([n]) => n),
    }))
    .sort((a, b) => b.cargas - a.cargas);
}

/**
 * Desglose de cadena de frío: dónde se concentran las excursiones.
 *
 * Usa `alertas_log` en vez de `lecturas_temperatura` porque agrupar las decenas
 * de miles de lecturas por transportista obligaría a paginar la API (PostgREST
 * devuelve máximo 1000 filas por petición). Cada alerta representa 30 minutos
 * continuos fuera de rango, así que sirve de medida de qué tan mal estuvo cada
 * viaje, y en un mes pesa unos 50 KB.
 */
export function detalleCadenaFrio(
  idsAlertas: string[],
  ordenes: OrdenDashboard[]
): DetalleFrio {
  const ids = idsAlertas;

  const porViaje = new Map<string, number>();
  for (const v of ids) porViaje.set(v, (porViaje.get(v) ?? 0) + 1);

  // Contexto de cada viaje (transportista, cliente, número) desde las cargas que
  // ya se trajeron para el periodo: no hace falta otra consulta.
  const ctx = new Map<string, { numero: number; transportista: string; cliente: string }>();
  for (const o of ordenes) {
    if (!o.viaje?.id || ctx.has(o.viaje.id)) continue;
    ctx.set(o.viaje.id, {
      numero: o.viaje.numero,
      transportista: transportistaDe(o),
      cliente: o.cliente?.trim() || "Sin cliente",
    });
  }

  const porTransp = new Map<string, { alertas: number; viajes: Set<string> }>();
  const viajes: DetalleFrio["viajes"] = [];

  for (const [viajeId, alertas] of porViaje) {
    const c = ctx.get(viajeId);
    if (!c) continue; // el viaje no pertenece al periodo filtrado
    viajes.push({ viajeId, numero: c.numero, transportista: c.transportista, cliente: c.cliente, alertas });

    const t = porTransp.get(c.transportista) ?? { alertas: 0, viajes: new Set<string>() };
    t.alertas += alertas;
    t.viajes.add(viajeId);
    porTransp.set(c.transportista, t);
  }

  return {
    porTransportista: Array.from(porTransp.entries())
      .map(([nombre, t]) => ({ nombre, alertas: t.alertas, viajes: t.viajes.size }))
      .sort((a, b) => b.alertas - a.alertas),
    viajes: viajes.sort((a, b) => b.alertas - a.alertas),
  };
}
