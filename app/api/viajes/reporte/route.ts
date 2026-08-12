import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import type { Viaje, OrdenVenta, Termografo } from "@/lib/types";
import { IMPORTACION_LABELS } from "@/lib/types";
import { to12h } from "@/lib/time";
import { formatFechaHora } from "@/lib/fecha";

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  TRANSITO: "En tránsito",
  ENTREGADO: "Entregado",
  RECHAZO_CALIDAD: "Rechazo calidad",
};

const siNo = (v: boolean | null | undefined) => (v ? "Sí" : "No");

// Fila que devuelve la RPC ultima_lectura_por_termografo (migración 024).
// numeric de Postgres llega como string por el driver, de ahí el Number() al usarla.
type UltimaLectura = {
  viaje_id: string;
  termografo_id: string;
  temperatura: number | string | null;
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
      linea:lineas_transportista!linea_transportista_id ( nombre, concesionario:concesionarios!concesionario_id ( nombre ) ),
      ordenes_venta (
        *,
        productos:orden_productos(id, producto_id, cajas, producto:productos(id, nombre))
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

  // Termógrafos asignados (modelo multi, atados por viaje_id). Igual que en la
  // pantalla de viajes: se cargan aparte para evitar la ambigüedad de las dos
  // relaciones viajes↔termografos.
  const { data: termosData } = viajeIds.length
    ? await supabase
        .from("termografos")
        .select("id, nombre, asignado, viaje_id, ultima_actividad, deshabilitado")
        .eq("asignado", true)
        .in("viaje_id", viajeIds)
    : { data: [] as Termografo[] };

  const termosByViaje = new Map<string, Termografo[]>();
  for (const t of (termosData ?? []) as Termografo[]) {
    if (!t.viaje_id) continue;
    const list = termosByViaje.get(t.viaje_id) ?? [];
    list.push(t);
    termosByViaje.set(t.viaje_id, list);
  }

  // Temp de carga = promedio de la última lectura de cada termógrafo asignado y NO
  // deshabilitado. Se replica el mismo cálculo de app/(app)/viajes/page.tsx para que
  // la columna "Temp" del Excel cuadre con la que se ve en la tabla.
  //
  // La RPC (migración 024) hace los index scans del lado del servidor y devuelve
  // todo en un round-trip; antes era una query por termógrafo. Si fallara (p. ej.
  // deploy previo a la migración) se degrada a viaje.temp_actual, sin romper el export.
  const { data: ultimas, error: rpcError } = await supabase.rpc(
    "ultima_lectura_por_termografo",
    { p_viaje_ids: viajeIds }
  );
  if (rpcError) {
    console.error("[reporte] ultima_lectura_por_termografo falló:", rpcError.message);
  }

  const tempAcc = new Map<string, { sum: number; n: number }>();
  for (const r of (ultimas ?? []) as UltimaLectura[]) {
    if (r.temperatura == null) continue;
    const a = tempAcc.get(r.viaje_id) ?? { sum: 0, n: 0 };
    a.sum += Number(r.temperatura);
    a.n += 1;
    tempAcc.set(r.viaje_id, a);
  }

  const rows: Record<string, string | number | null>[] = [];

  for (const v of viajes) {
    const ovs: OrdenVenta[] = ovsForSeccion(v.ordenes_venta ?? [], seccion);
    const responsableNombre = v.responsable?.nombre ?? v.responsable?.email ?? null;

    // Ubicación: mismo criterio que la tabla — estado si se resolvió, si no ciudad.
    const ubicacion = v.ubicacion_estado ?? v.ubicacion_ciudad ?? null;

    const acc = tempAcc.get(v.id);
    const tempCarga = acc ? Number((acc.sum / acc.n).toFixed(2)) : v.temp_actual ?? null;

    const termos = termosByViaje.get(v.id) ?? [];
    const termosLabel =
      termos.length > 0
        ? termos
            .map((t) => `${t.nombre ?? t.id}${t.deshabilitado ? " (deshabilitado)" : ""}`)
            .join(", ")
        : null;

    for (const ov of ovs) {
      // Una fila por producto de la OV (Fase 5). Si la OV no tiene productos,
      // igual sale una fila con producto/cajas vacíos.
      const lineas = (ov.productos ?? []).length > 0
        ? (ov.productos ?? [])
        : [{ producto: null, cajas: null } as { producto?: { nombre: string } | null; cajas: number | null }];

      for (const linea of lineas) {
        rows.push({
          // ---- Nivel OV ----
          "OV / Ref": ov.ov_ref,
          "Cliente": ov.cliente,
          "CEDI": ov.cedi ?? null,
          "PO": ov.po ?? null,
          "Factura G&S": ov.factura_gys ?? null,
          "Fecha Carga": ov.fecha_carga,
          "Lugar Carga": ov.lugar_carga,
          "Fecha Entrega": ov.fecha_entrega,
          "Lugar Entrega": ov.lugar_entrega,
          "Cita": to12h(ov.cita) ?? null,
          "Folio Cita": ov.folio_cita ?? null,
          "Status": STATUS_LABELS[ov.status] ?? ov.status,
          "Instrucciones": ov.instrucciones ?? null,
          "Producto": linea.producto?.nombre ?? null,
          "Cajas": linea.cajas ?? null,
          // ---- Nivel viaje ----
          "# Viaje": v.numero,
          "Origen": v.lugar_inicio,
          "Destino": v.lugar_fin,
          "Fecha Inicio": v.fecha_inicio,
          "Fecha Fin": v.fecha_fin,
          "Ubicación": ubicacion,
          "Importación": siNo(v.es_importacion),
          "Etapa Importación": v.importacion_estado
            ? IMPORTACION_LABELS[v.importacion_estado] ?? v.importacion_estado
            : null,
          "Temp": tempCarga,
          "Temp Mín": v.temp_min ?? null,
          "Temp Máx": v.temp_max ?? null,
          "Alerta Activa": siNo(v.alerta_activa),
          "Termógrafos": termosLabel,
          "Última Lectura": formatFechaHora(v.ultima_lectura) || null,
          "Flete": v.linea?.concesionario?.nombre ?? v.flete_cargo ?? null,
          "Línea Transportista": v.linea?.nombre ?? null,
          "Operador": v.operador ?? null,
          "Contacto Unidad": v.contacto_unidad ?? null,
          "Modelo": v.modelo ?? null,
          "Año": v.anio ?? null,
          "Placas Tracto": v.placas_tracto ?? null,
          "Placas Caja": v.placas_caja ?? null,
          "Responsable": responsableNombre,
        });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Viajes");

  // El orden debe coincidir 1:1 con las llaves de rows.push().
  const colWidths = [
    { wch: 14 },  // OV / Ref
    { wch: 22 },  // Cliente
    { wch: 14 },  // CEDI
    { wch: 14 },  // PO
    { wch: 14 },  // Factura G&S
    { wch: 12 },  // Fecha Carga
    { wch: 18 },  // Lugar Carga
    { wch: 12 },  // Fecha Entrega
    { wch: 18 },  // Lugar Entrega
    { wch: 10 },  // Cita
    { wch: 14 },  // Folio Cita
    { wch: 16 },  // Status
    { wch: 30 },  // Instrucciones
    { wch: 24 },  // Producto
    { wch: 8 },   // Cajas
    { wch: 8 },   // # Viaje
    { wch: 16 },  // Origen
    { wch: 16 },  // Destino
    { wch: 12 },  // Fecha Inicio
    { wch: 12 },  // Fecha Fin
    { wch: 18 },  // Ubicación
    { wch: 12 },  // Importación
    { wch: 24 },  // Etapa Importación
    { wch: 8 },   // Temp
    { wch: 9 },   // Temp Mín
    { wch: 9 },   // Temp Máx
    { wch: 12 },  // Alerta Activa
    { wch: 26 },  // Termógrafos
    { wch: 18 },  // Última Lectura
    { wch: 18 },  // Flete
    { wch: 22 },  // Línea Transportista
    { wch: 20 },  // Operador
    { wch: 16 },  // Contacto Unidad
    { wch: 14 },  // Modelo
    { wch: 8 },   // Año
    { wch: 14 },  // Placas Tracto
    { wch: 14 },  // Placas Caja
    { wch: 20 },  // Responsable
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
