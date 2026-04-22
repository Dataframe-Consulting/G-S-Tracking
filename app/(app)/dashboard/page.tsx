import { createServerSupabase } from "@/lib/supabase/server";
import type { Carga, Producto } from "@/lib/types";
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

  // Cargas en el rango
  let q = supabase
    .from("cargas")
    .select(`*, producto:productos(id, nombre, temp_min, temp_max)`)
    .gte("fecha_carga", fechaDesde)
    .lte("fecha_carga", fechaHasta)
    .order("fecha_carga", { ascending: true });

  if (productoId) q = q.eq("producto_id", productoId);

  const [{ data }, { data: productosData }] = await Promise.all([
    q,
    supabase.from("productos").select("*").order("nombre"),
  ]);

  const cargas = (data ?? []) as Carga[];
  const productos = (productosData ?? []) as Producto[];

  // KPIs
  const total = cargas.length;
  const enTransito = cargas.filter((c) => c.status === "TRANSITO").length;
  const alertas = cargas.filter((c) => c.alerta_activa).length;
  const entregadas = cargas.filter(
    (c) => c.status === "ENTREGADO" || c.status === "RECIBIDO"
  ).length;

  // Chart 1: cargas por fecha — fill every day in the range with zeros
  const fechaMap = new Map<string, ChartCargaRow>();
  const cursor = new Date(fechaDesde + "T12:00:00Z");
  const end = new Date(fechaHasta + "T12:00:00Z");
  while (cursor <= end) {
    const f = cursor.toISOString().slice(0, 10);
    fechaMap.set(f, { fecha: f, total: 0, transito: 0, entregadas: 0, alertas: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  for (const c of cargas) {
    const f = c.fecha_carga;
    if (!fechaMap.has(f))
      fechaMap.set(f, { fecha: f, total: 0, transito: 0, entregadas: 0, alertas: 0 });
    const row = fechaMap.get(f)!;
    row.total++;
    if (c.status === "TRANSITO") row.transito++;
    if (c.status === "ENTREGADO" || c.status === "RECIBIDO") row.entregadas++;
    if (c.alerta_activa) row.alertas++;
  }
  const byFecha: ChartCargaRow[] = Array.from(fechaMap.values()).sort(
    (a, b) => a.fecha.localeCompare(b.fecha)
  );

  // Chart 2: por transportista (top 8)
  const transportistaMap = new Map<string, number>();
  for (const c of cargas) {
    const t = c.flete_cargo?.trim() || "Sin asignar";
    transportistaMap.set(t, (transportistaMap.get(t) ?? 0) + 1);
  }
  const byTransportista: ChartTransportistaRow[] = Array.from(transportistaMap.entries())
    .map(([transportista, count]) => ({ transportista, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Chart 3: por cliente (top 8)
  const clienteMap = new Map<string, number>();
  for (const c of cargas) {
    clienteMap.set(c.cliente, (clienteMap.get(c.cliente) ?? 0) + 1);
  }
  const byCliente: ChartClienteRow[] = Array.from(clienteMap.entries())
    .map(([cliente, count]) => ({ cliente, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Operación — temperatura, ubicación y alertas en tiempo real.
        </p>
      </div>

      <DashboardFilters
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        productoId={productoId}
        productos={productos}
      />

      <KpiCards
        total={total}
        enTransito={enTransito}
        alertas={alertas}
        entregadas={entregadas}
      />

      <DashboardCharts
        byFecha={byFecha}
        byTransportista={byTransportista}
        byCliente={byCliente}
      />

      <DashboardLive />
    </div>
  );
}
