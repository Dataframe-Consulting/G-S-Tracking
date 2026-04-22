import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .order("nombre");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { nombre, temp_min, temp_max } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (temp_min == null || temp_max == null) return NextResponse.json({ error: "Rango de temperatura requerido" }, { status: 400 });
  if (Number(temp_min) >= Number(temp_max)) return NextResponse.json({ error: "Temp mínima debe ser menor a la máxima" }, { status: 400 });
  const { data, error } = await supabase
    .from("productos")
    .insert({ nombre: nombre.trim(), temp_min: Number(temp_min), temp_max: Number(temp_max) })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
