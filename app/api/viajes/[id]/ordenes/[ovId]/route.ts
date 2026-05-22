import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; ovId: string } }
) {
  const supabase = createServerSupabase();
  const body = await req.json();

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "ov_ref",
    "cliente",
    "cedi",
    "fecha_carga",
    "lugar_carga",
    "fecha_entrega",
    "lugar_entrega",
    "cita",
    "status",
    "instrucciones",
    "producto_id",
    "producto_combinacion_id",
    "cajas",
    "cajas_b",
  ];
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await supabase
    .from("ordenes_venta")
    .update(update)
    .eq("id", params.ovId)
    .eq("viaje_id", params.id)
    .select(`*, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre))`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; ovId: string } }
) {
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("ordenes_venta")
    .delete()
    .eq("id", params.ovId)
    .eq("viaje_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
