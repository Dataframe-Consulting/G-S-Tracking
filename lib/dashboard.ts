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
  lecturas: number;
  /** Termógrafos asignados a viajes sin concluir que llevan horas sin reportar. */
  termografosSinReportar: number;
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

  // Termógrafos asignados a viajes aún no concluidos que llevan >6 h sin reportar.
  // Es el síntoma que dejó al viaje #0282 sin rastreo durante tres días.
  const { data: termos } = await supabase
    .from("termografos")
    .select("id, viaje_id, ultima_actividad")
    .eq("asignado", true)
    .eq("deshabilitado", false)
    .not("viaje_id", "is", null);

  let termografosSinReportar = 0;
  if (termos && termos.length > 0) {
    const viajeIds = [...new Set(termos.map((t) => t.viaje_id as string))];
    const { data: ovs } = await supabase
      .from("ordenes_venta")
      .select("viaje_id, status")
      .in("viaje_id", viajeIds);

    const concluido = new Map<string, boolean>();
    for (const o of ovs ?? []) {
      const vid = o.viaje_id as string;
      const terminal = o.status === "ENTREGADO" || o.status === "RECHAZO_CALIDAD";
      concluido.set(vid, (concluido.get(vid) ?? true) && terminal);
    }

    const corte = Date.now() - 6 * 3600_000;
    for (const t of termos) {
      if (concluido.get(t.viaje_id as string) !== false) continue; // viaje concluido o sin cargas
      const ult = t.ultima_actividad ? new Date(t.ultima_actividad as string).getTime() : 0;
      if (ult < corte) termografosSinReportar++;
    }
  }

  return {
    lecturas,
    pctEnRango: lecturas > 0 ? Math.round((enRango / lecturas) * 1000) / 10 : null,
    termografosSinReportar,
  };
}

/** Viajes que tuvieron al menos una alerta en el periodo. Se traen solo los
 *  `viaje_id` (unos 50 KB en 30 días) y se deduplican aquí. */
export async function viajesConAlertaEnPeriodo(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("alertas_log")
    .select("viaje_id")
    .gte("created_at", inicioDelDiaUTC(desde))
    .lt("created_at", finDelDiaUTC(hasta))
    .limit(50000);

  const set = new Set<string>();
  for (const a of data ?? []) if (a.viaje_id) set.add(a.viaje_id as string);
  return set;
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
