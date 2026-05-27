import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/types";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("ordenes_venta")
    .select(`*, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre))`)
    .eq("viaje_id", params.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const required = [
    "ov_ref",
    "cliente",
    "fecha_carga",
    "lugar_carga",
    "fecha_entrega",
  ];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });
  }

  if (!body.producto_id && !body.producto_combinacion_id) {
    return NextResponse.json({ error: "Falta producto" }, { status: 400 });
  }

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const payload = {
    viaje_id: params.id,
    ov_ref: body.ov_ref,
    cliente: body.cliente,
    cedi: body.cedi ?? null,
    fecha_carga: body.fecha_carga,
    lugar_carga: body.lugar_carga,
    fecha_entrega: body.fecha_entrega,
    lugar_entrega: body.lugar_entrega ?? "",
    cita: body.cita ?? null,
    status: body.status ?? "PENDIENTE",
    instrucciones: body.instrucciones ?? "",
    producto_id: body.producto_id ?? null,
    producto_combinacion_id: body.producto_combinacion_id ?? null,
    cajas: body.cajas != null ? Number(body.cajas) : null,
    cajas_b: body.cajas_b != null ? Number(body.cajas_b) : null,
  };

  const { data, error } = await supabase
    .from("ordenes_venta")
    .insert(payload)
    .select(`*, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre))`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const prod = data.producto?.nombre
    ? data.producto.nombre
    : data.combo
      ? `${data.combo.producto_a?.nombre ?? "?"} + ${data.combo.producto_b?.nombre ?? "?"}`
      : null;
  const detalle = prod ? `${data.cliente} - ${prod}` : data.cliente;
  await logAudit(supabase, {
    viaje_id: params.id,
    ov_id: data.id,
    tipo: "CREACION",
    descripcion: `Creó OV ${data.ov_ref} (${detalle})`,
  });

  return NextResponse.json({ data }, { status: 201 });
}
