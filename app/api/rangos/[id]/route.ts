import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { temp_min, temp_max, producto_ids } = await req.json();

  if (temp_min == null || temp_max == null) {
    return NextResponse.json({ error: "Rango (mín y máx) requerido" }, { status: 400 });
  }
  if (Number(temp_min) >= Number(temp_max)) {
    return NextResponse.json({ error: "La mínima debe ser menor que la máxima" }, { status: 400 });
  }

  const { data: rango, error } = await supabase
    .from("rangos_temperatura")
    .update({ temp_min: Number(temp_min), temp_max: Number(temp_max) })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Reconciliar productos del rango: reset (los que tenía) y reasignar el set nuevo.
  const ids = Array.isArray(producto_ids) ? (producto_ids as string[]) : [];
  await supabase.from("productos").update({ rango_id: null }).eq("rango_id", params.id);
  if (ids.length > 0) {
    await supabase.from("productos").update({ rango_id: params.id }).in("id", ids);
  }

  // Propagar el nuevo rango a los viajes que lo usan (modo "Catálogo" → se actualiza en vivo).
  await supabase
    .from("viajes")
    .update({ temp_min: Number(temp_min), temp_max: Number(temp_max), updated_at: new Date().toISOString() })
    .eq("temp_rango_id", params.id);

  return NextResponse.json({ data: rango });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  // FK on delete set null: limpia productos.rango_id y viajes.temp_rango_id solos.
  // Los viajes conservan su temp_min/max (pasan a modo "Manual").
  const { error } = await supabase.from("rangos_temperatura").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
