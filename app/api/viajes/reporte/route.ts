import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import type { Viaje, OrdenVenta } from "@/lib/types";
import { to12h } from "@/lib/time";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  TRANSITO: "En tránsito",
  ENTREGADO: "Entregado",
  RECHAZO_CALIDAD: "Rechazo calidad",
};

type Seccion = "activos" | "completados" | "rechazados";

// Recorta las OVs de un viaje según la sección, igual que la tabla:
//   activos     → todas · completados → solo entregadas · rechazados → solo rechazadas
function ovsForSeccion(ovs: OrdenVenta[], seccion: Seccion): OrdenVenta[] {
  if (seccion === "completados") return ovs.filter((o) => o.status === "ENTREGADO");
  if (seccion === "rechazados") return ovs.filter((o) => o.status === "RECHAZO_CALIDAD");
  return ovs;
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();

  const body = (await req.json().catch(() => ({}))) as {
    seccion?: Seccion;
    viaje_ids?: string[];
  };
  const seccion: Seccion = body.seccion ?? "activos";
  const viajeIds = Array.isArray(body.viaje_ids) ? body.viaje_ids : [];

  if (viajeIds.length === 0) {
    return NextResponse.json({ error: "Sin viajes para exportar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("viajes")
    .select(`
      *,
      responsable:user_profiles!responsable_id(id, nombre, email),
      ordenes_venta (
        *,
        producto:productos(id, nombre, temp_min, temp_max),
        combo:producto_combinaciones!producto_combinacion_id(
          id, temp_min, temp_max,
          producto_a:productos!producto_a_id(id, nombre),
          producto_b:productos!producto_b_id(id, nombre)
        )
      )
    `)
    .in("id", viajeIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Respetar el orden en que la tabla los mostró (el cliente manda viaje_ids ya
  // ordenados según la sección y filtros), para que el Excel cuadre con la pantalla.
  const orderIndex = new Map(viajeIds.map((id, i) => [id, i]));
  const viajes = ((data ?? []) as Viaje[]).sort(
    (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
  );

  const rows: Record<string, string | number | null>[] = [];

  for (const v of viajes) {
    const ovs: OrdenVenta[] = ovsForSeccion(v.ordenes_venta ?? [], seccion);
    const responsableNombre = v.responsable?.nombre ?? v.responsable?.email ?? null;

    for (const ov of ovs) {
      let producto = null;
      if (ov.producto) {
        producto = ov.producto.nombre;
      } else if (ov.combo) {
        const a = ov.combo.producto_a?.nombre ?? "";
        const b = ov.combo.producto_b?.nombre ?? "";
        producto = `${a} + ${b}`;
      }

      rows.push({
        "OV / Ref": ov.ov_ref,
        "Cliente": ov.cliente,
        "CEDI": ov.cedi ?? null,
        "Fecha Carga": ov.fecha_carga,
        "Lugar Carga": ov.lugar_carga,
        "Fecha Entrega": ov.fecha_entrega,
        "Lugar Entrega": ov.lugar_entrega,
        "Cita": to12h(ov.cita) ?? null,
        "Status": STATUS_LABELS[ov.status] ?? ov.status,
        "Instrucciones": ov.instrucciones ?? null,
        "Producto": producto,
        "Cajas": ov.cajas ?? null,
        "Cajas B": ov.cajas_b ?? null,
        "# Viaje": v.numero,
        "Origen": v.lugar_inicio,
        "Destino": v.lugar_fin,
        "Fecha Inicio": v.fecha_inicio,
        "Fecha Fin": v.fecha_fin,
        "Flete": v.flete_cargo ?? null,
        "Responsable": responsableNombre,
        "Temperatura Actual": v.temp_actual ?? null,
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");

  const colWidths = [
    { wch: 14 },  // OV / Ref
    { wch: 22 },  // Cliente
    { wch: 14 },  // CEDI
    { wch: 12 },  // Fecha Carga
    { wch: 18 },  // Lugar Carga
    { wch: 12 },  // Fecha Entrega
    { wch: 18 },  // Lugar Entrega
    { wch: 10 },  // Cita
    { wch: 16 },  // Status
    { wch: 30 },  // Instrucciones
    { wch: 24 },  // Producto
    { wch: 8 },   // Cajas
    { wch: 8 },   // Cajas B
    { wch: 8 },   // # Viaje
    { wch: 16 },  // Origen
    { wch: 16 },  // Destino
    { wch: 12 },  // Fecha Inicio
    { wch: 12 },  // Fecha Fin
    { wch: 18 },  // Flete
    { wch: 20 },  // Responsable
    { wch: 12 },  // Temperatura Actual
  ];
  ws["!cols"] = colWidths;

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="viajes_${seccion}_${today}.xlsx"`,
    },
  });
}
