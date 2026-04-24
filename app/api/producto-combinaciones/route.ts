import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("producto_combinaciones")
    .select(`*, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)`)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { producto_a_id, producto_b_id, temp_min, temp_max } = await req.json();
  if (!producto_a_id || !producto_b_id) return NextResponse.json({ error: "Selecciona ambos productos" }, { status: 400 });
  if (producto_a_id === producto_b_id) return NextResponse.json({ error: "Los productos deben ser diferentes" }, { status: 400 });
  if (temp_min == null || temp_max == null) return NextResponse.json({ error: "Rango de temperatura requerido" }, { status: 400 });
  if (Number(temp_min) >= Number(temp_max)) return NextResponse.json({ error: "Temp mínima debe ser menor a la máxima" }, { status: 400 });
  const { data, error } = await supabase
    .from("producto_combinaciones")
    .insert({ producto_a_id, producto_b_id, temp_min: Number(temp_min), temp_max: Number(temp_max) })
    .select(`*, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)`)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
