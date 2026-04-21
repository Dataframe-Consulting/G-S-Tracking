import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/types";

export async function GET(req: Request) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha"); // YYYY-MM-DD
  const status = searchParams.get("status");

  let q = supabase
    .from("cargas")
    .select(`*, producto:productos ( id, nombre, temp_min, temp_max )`)
    .order("fecha_carga", { ascending: false })
    .order("created_at", { ascending: false });

  if (fecha) q = q.eq("fecha_carga", fecha);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const required = [
    "fecha_carga",
    "fecha_entrega",
    "cliente",
    "ov_ref",
    "lugar_carga",
    "producto_descripcion"
  ];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });
  }

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const payload = {
    fecha_carga: body.fecha_carga,
    fecha_entrega: body.fecha_entrega,
    cita: body.cita ?? null,
    cliente: body.cliente,
    ov_ref: body.ov_ref,
    lugar_carga: body.lugar_carga,
    producto_descripcion: body.producto_descripcion,
    producto_id: body.producto_id ?? null,
    status: body.status ?? "PENDIENTE",
    flete_cargo: body.flete_cargo ?? null,
    termografo_id: body.termografo_id ?? null
  };

  const { data, error } = await supabase
    .from("cargas")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data.termografo_id) {
    await supabase
      .from("termografos")
      .update({ asignado: true, carga_id: data.id })
      .eq("id", data.termografo_id);
  }

  return NextResponse.json({ data }, { status: 201 });
}
