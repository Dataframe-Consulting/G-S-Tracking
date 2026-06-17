import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/types";
import { logAudit } from "@/lib/audit";

const OV_SELECT = `*, productos:orden_productos(id, producto_id, cajas, producto:productos(id, nombre))`;

// Productos del body (Fase 5): [{ producto_id, cajas }]. Filtra los válidos.
type ProductoInput = { producto_id?: string; cajas?: number | null };
function parseProductos(body: { productos?: ProductoInput[] }) {
  return (Array.isArray(body.productos) ? body.productos : [])
    .filter((p) => p && p.producto_id)
    .map((p) => ({ producto_id: p.producto_id as string, cajas: p.cajas != null ? Number(p.cajas) : null }));
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("ordenes_venta")
    .select(OV_SELECT)
    .eq("viaje_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const required = ["cliente", "fecha_carga", "lugar_carga"];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });
  }

  const productos = parseProductos(body);
  if (productos.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un producto" }, { status: 400 });
  }

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const payload = {
    viaje_id: params.id,
    ov_ref: body.ov_ref || null,
    cliente: body.cliente,
    cedi: body.cedi ?? null,
    fecha_carga: body.fecha_carga,
    lugar_carga: body.lugar_carga,
    fecha_entrega: body.fecha_entrega || null,
    lugar_entrega: body.lugar_entrega ?? "",
    cita: body.cita ?? null,
    tiene_cita: body.tiene_cita ?? false,
    po: body.po || null,
    folio_cita: body.folio_cita || null,
    factura_gys: body.factura_gys || null,
    status: body.status ?? "PENDIENTE",
    instrucciones: body.instrucciones ?? "",
  };

  const { data: created, error } = await supabase
    .from("ordenes_venta")
    .insert(payload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase
    .from("orden_productos")
    .insert(productos.map((p) => ({ orden_id: created.id, producto_id: p.producto_id, cajas: p.cajas })));

  const { data } = await supabase.from("ordenes_venta").select(OV_SELECT).eq("id", created.id).single();

  await logAudit(supabase, {
    viaje_id: params.id,
    ov_id: created.id,
    tipo: "CREACION",
    descripcion: `Creó OV ${data?.ov_ref ?? "(sin ref)"} (${body.cliente})`,
  });

  return NextResponse.json({ data }, { status: 201 });
}
