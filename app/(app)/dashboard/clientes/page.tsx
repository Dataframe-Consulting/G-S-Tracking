import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto } from "@/lib/types";
import { DashboardFilters } from "../Filters";
import { TablaDetalle, type CargaDetalle } from "@/components/Dashboard/TablaDetalle";
import { TabsDashboard } from "@/components/Dashboard/TabsDashboard";
import {
  hoySonora,
  diasAtrasSonora,
  cargasDelPeriodo,
  alertasDelPeriodo,
  viajesConAlerta,
  diasDelPeriodo,
  agrupar,
  transportistaDe,
  productosDe,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { fecha_desde?: string; fecha_hasta?: string; producto_id?: string; ver?: string };
}) {
  const supabase = createServerSupabase();

  const fechaDesde = searchParams.fecha_desde ?? diasAtrasSonora(29);
  const fechaHasta = searchParams.fecha_hasta ?? hoySonora();
  const productoId = searchParams.producto_id ?? "";

  const [ordenes, idsAlertas, { data: productosData }] = await Promise.all([
    cargasDelPeriodo(supabase, fechaDesde, fechaHasta, productoId || undefined),
    alertasDelPeriodo(supabase, fechaDesde, fechaHasta),
    supabase.from("productos").select("*").order("nombre"),
  ]);

  const viajesAlerta = viajesConAlerta(idsAlertas);
  const dias = diasDelPeriodo(fechaDesde, fechaHasta);
  const filas = agrupar(ordenes, "cliente", viajesAlerta, dias);

  const cargas: CargaDetalle[] = ordenes.map((o) => ({
    id: o.id,
    fecha: o.fecha_carga,
    ovRef: o.ov_ref,
    cliente: o.cliente?.trim() || "Sin cliente",
    transportista: transportistaDe(o),
    productos: productosDe(o),
    status: o.status,
    viajeNumero: o.viaje?.numero ?? null,
    viajeConAlerta: !!(o.viaje?.id && viajesAlerta.has(o.viaje.id)),
  }));

  const transportistas = Array.from(new Set(cargas.map((c) => c.transportista))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-brand-900 tracking-tight">Clientes</h1>
        <p className="text-sm text-brand-400 mt-0.5">
          Volumen, productos y rechazos por cliente
        </p>
      </div>

      <TabsDashboard />

      <DashboardFilters
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        productoId={productoId}
        productos={(productosData ?? []) as Producto[]}
        basePath="/dashboard/clientes"
      />

      <TablaDetalle tipo="cliente" filas={filas} cargas={cargas} opcionesFiltro={transportistas} dias={dias} />
    </div>
  );
}
