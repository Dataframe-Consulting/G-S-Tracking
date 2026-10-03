import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto, Status } from "@/lib/types";
import { DashboardFilters } from "./Filters";
import { DashboardLive } from "./Live";
import { BloqueAhora } from "@/components/Dashboard/BloqueAhora";
import { CadenaFrioCard } from "@/components/Dashboard/CadenaFrioCard";
import { PeriodoCard } from "@/components/Dashboard/PeriodoCard";
import { CargasPorDia } from "@/components/Dashboard/CargasPorDia";
import { TopBarras } from "@/components/Dashboard/TopBarras";
import { TabsDashboard } from "@/components/Dashboard/TabsDashboard";
import {
  hoySonora,
  diasAtrasSonora,
  cargasDelPeriodo,
  estadoAhora,
  cadenaFrio,
  detalleCadenaFrio,
  alertasDelPeriodo,
  viajesConAlerta,
  diasDelPeriodo,
  agrupar,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { fecha_desde?: string; fecha_hasta?: string; producto_id?: string };
}) {
  const supabase = createServerSupabase();

  const hoy = hoySonora();
  const fechaDesde = searchParams.fecha_desde ?? diasAtrasSonora(29);
  const fechaHasta = searchParams.fecha_hasta ?? hoy;
  const productoId = searchParams.producto_id ?? "";

  const [ordenes, ahora, idsAlertas, { data: productosData }] = await Promise.all([
    cargasDelPeriodo(supabase, fechaDesde, fechaHasta, productoId || undefined),
    estadoAhora(supabase),
    alertasDelPeriodo(supabase, fechaDesde, fechaHasta),
    supabase.from("productos").select("*").order("nombre"),
  ]);

  // Con filtro de producto, la cadena de frío se acota a los viajes de esas
  // cargas; sin filtro, cuenta todas las mediciones del periodo.
  const viajesDelFiltro = productoId
    ? [...new Set(ordenes.map((o) => o.viaje?.id).filter(Boolean) as string[])]
    : undefined;
  const frio = await cadenaFrio(supabase, fechaDesde, fechaHasta, viajesDelFiltro);

  const productos = (productosData ?? []) as Producto[];
  const viajesAlerta = viajesConAlerta(idsAlertas);
  const detalleFrio = detalleCadenaFrio(idsAlertas, ordenes);

  const porStatus: Record<Status, number> = {
    PENDIENTE: 0,
    EN_PREPARACION: 0,
    TRANSITO: 0,
    ENTREGADO: 0,
    RECHAZO_CALIDAD: 0,
  };
  for (const o of ordenes) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;

  const dias = diasDelPeriodo(fechaDesde, fechaHasta);
  const conteoPorDia = new Map<string, number>(dias.map((d) => [d, 0]));
  for (const o of ordenes) {
    conteoPorDia.set(o.fecha_carga, (conteoPorDia.get(o.fecha_carga) ?? 0) + 1);
  }
  const byFecha = dias.map((fecha) => ({ fecha, total: conteoPorDia.get(fecha) ?? 0 }));

  const transportistas = agrupar(ordenes, "transportista", viajesAlerta, dias);
  const clientes = agrupar(ordenes, "cliente", viajesAlerta, dias);

  const qs = new URLSearchParams();
  if (searchParams.fecha_desde) qs.set("fecha_desde", fechaDesde);
  if (searchParams.fecha_hasta) qs.set("fecha_hasta", fechaHasta);
  if (productoId) qs.set("producto_id", productoId);
  const sufijo = qs.toString() ? `?${qs}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-brand-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-brand-400 mt-0.5">Operación y trazabilidad de cargas</p>
      </div>

      <TabsDashboard />

      <DashboardFilters
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        productoId={productoId}
        productos={productos}
      />

      <BloqueAhora ahora={ahora} />
      <CadenaFrioCard frio={frio} detalle={detalleFrio} />
      <PeriodoCard total={ordenes.length} porStatus={porStatus} desde={fechaDesde} hasta={fechaHasta} />

      <CargasPorDia datos={byFecha} hoy={hoy} />

      <div className="grid lg:grid-cols-2 gap-4">
        <TopBarras
          titulo="Top transportistas"
          filas={transportistas}
          href={`/dashboard/transportistas${sufijo}`}
          tipo="transportista"
        />
        <TopBarras
          titulo="Top clientes"
          filas={clientes}
          href={`/dashboard/clientes${sufijo}`}
          tipo="cliente"
        />
      </div>

      <DashboardLive />
    </div>
  );
}
