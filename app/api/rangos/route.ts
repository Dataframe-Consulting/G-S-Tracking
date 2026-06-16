import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Rangos de temperatura (catálogo). Cada rango = (temp_min, temp_max) en °C.
// Los productos asignados se modelan en productos.rango_id (un producto → un rango).

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("rangos_temperatura")
    .select(`*, productos:productos!rango_id(id, nombre)`)
    .order("temp_min", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
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
    .insert({ temp_min: Number(temp_min), temp_max: Number(temp_max) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Asignar productos a este rango (los mueve desde cualquier rango anterior).
  const ids = Array.isArray(producto_ids) ? (producto_ids as string[]) : [];
  if (ids.length > 0) {
    await supabase.from("productos").update({ rango_id: rango.id }).in("id", ids);
  }

  return NextResponse.json({ data: rango }, { status: 201 });
}
