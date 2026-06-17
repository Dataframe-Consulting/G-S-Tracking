import { createServerSupabase } from "@/lib/supabase/server";
import type { OrdenVenta, Producto, Status } from "@/lib/types";
import { KpiCards } from "@/components/Dashboard/KpiCards";
import { DashboardFilters } from "./Filters";
import { DashboardLive } from "./Live";
import { DashboardCharts } from "@/components/Dashboard/DashboardCharts";
import type {
  ChartCargaRow,
  ChartTransportistaRow,
  ChartClienteRow,
} from "@/components/Dashboard/DashboardCharts";

export const dynamic = "force-dynamic";

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { fecha_desde?: string; fecha_hasta?: string; producto_id?: string };
}) {
  const supabase = createServerSupabase();

  const fechaDesde = searchParams.fecha_desde ?? daysAgo(29);
  const fechaHasta = searchParams.fecha_hasta ?? today();
  const productoId = searchParams.producto_id ?? "";

  // Ordenes en el rango + viaje info para flete. Si se filtra por producto, se
  // hace join interno a orden_productos (Fase 5: el producto vive en esa tabla).
  const opJoin = productoId
    ? "orden_productos!inner(producto_id)"
    : "orden_productos(producto_id)";
  let q = supabase
    .from("ordenes_venta")
    .select(`*, ${opJoin}, viaje:viajes(id, flete_cargo, alerta_activa, linea:lineas_transportista!linea_transportista_id(concesionario:concesionarios!concesionario_id(nombre)))`)
    .gte("fecha_carga", fechaDesde)
    .lte("fecha_carga", fechaHasta)
    .order("fecha_carga", { ascending: true });

  if (productoId) q = q.eq("orden_productos.producto_id", productoId);

  const [{ data }, { data: productosData }] = await Promise.all([
    q,
    supabase.from("productos").select("*").order("nombre"),
  ]);

  const ordenes = (data ?? []) as (OrdenVenta & {
    viaje: {
      id: string;
      flete_cargo: string | null;
      alerta_activa: boolean;
      linea: { concesionario: { nombre: string } | null } | null;
    } | null;
  })[];
  const productos = (productosData ?? []) as Producto[];

  // KPIs
  const total = ordenes.length;
  // Desglose por status (suma = total).
  const porStatus = { PENDIENTE: 0, EN_PREPARACION: 0, TRANSITO: 0, ENTREGADO: 0, RECHAZO_CALIDAD: 0 } as Record<Status, number>;
  // Alertas: viajes (distintos) con alerta activa, dentro del mismo rango/producto
  // filtrado (derivado de las órdenes, ya no global).
  const viajesConAlerta = new Set<string>();
  for (const o of ordenes) {
    porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
    if (o.viaje?.alerta_activa && o.viaje.id) viajesConAlerta.add(o.viaje.id);
  }
  const alertas = viajesConAlerta.size;

  // Chart 1: ordenes por fecha
  const fechaMap = new Map<string, ChartCargaRow>();
  const cursor = new Date(fechaDesde + "T12:00:00Z");
  const end = new Date(fechaHasta + "T12:00:00Z");
  while (cursor <= end) {
    const f = cursor.toISOString().slice(0, 10);
    fechaMap.set(f, { fecha: f, total: 0, transito: 0, entregadas: 0, alertas: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const o of ordenes) {
    const f = o.fecha_carga;
    if (!fechaMap.has(f))
      fechaMap.set(f, { fecha: f, total: 0, transito: 0, entregadas: 0, alertas: 0 });
    const row = fechaMap.get(f)!;
    row.total++;
    if (o.status === "TRANSITO") row.transito++;
    if (o.status === "ENTREGADO") row.entregadas++;
    if (o.viaje?.alerta_activa) row.alertas++;
  }
  const byFecha: ChartCargaRow[] = Array.from(fechaMap.values()).sort(
    (a, b) => a.fecha.localeCompare(b.fecha)
  );

  // Chart 2: por transportista (top 8) — concesionario del modelo nuevo, con
  // fallback al campo legacy flete_cargo (mismo criterio que la tabla de viajes).
  const transportistaMap = new Map<string, number>();
  for (const o of ordenes) {
    const nombre = o.viaje?.linea?.concesionario?.nombre ?? o.viaje?.flete_cargo;
    const t = nombre?.trim() || "Sin asignar";
    transportistaMap.set(t, (transportistaMap.get(t) ?? 0) + 1);
  }
  const byTransportista: ChartTransportistaRow[] = Array.from(transportistaMap.entries())
    .map(([transportista, count]) => ({ transportista, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Chart 3: por cliente (top 8)
  const clienteMap = new Map<string, number>();
  for (const o of ordenes) {
    clienteMap.set(o.cliente, (clienteMap.get(o.cliente) ?? 0) + 1);
  }
  const byCliente: ChartClienteRow[] = Array.from(clienteMap.entries())
    .map(([cliente, count]) => ({ cliente, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-brand-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-brand-400 mt-0.5">
          Temperatura, ubicación y alertas en tiempo real.
        </p>
      </div>

      <DashboardFilters
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        productoId={productoId}
        productos={productos}
      />

      <KpiCards total={total} alertas={alertas} porStatus={porStatus} />

      <DashboardCharts
        byFecha={byFecha}
        byTransportista={byTransportista}
        byCliente={byCliente}
      />

      <DashboardLive />
    </div>
  );
}
