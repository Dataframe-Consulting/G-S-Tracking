import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const temp_min = Number(body.temp_min);
  const temp_max = Number(body.temp_max);
  if (temp_min >= temp_max)
    return NextResponse.json({ error: "Temp mínima debe ser menor a la máxima" }, { status: 400 });
  const { data, error } = await supabase
    .from("producto_combinaciones")
    .update({ temp_min, temp_max })
    .eq("id", params.id)
    .select("id, producto_a_id, producto_b_id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { count } = await supabase
    .from("ordenes_venta")
    .select("id", { count: "exact", head: true })
    .eq("producto_combinacion_id", params.id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: hay ${count} orden${count !== 1 ? "es" : ""} de venta asociada${count !== 1 ? "s" : ""} a esta combinación.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("producto_combinaciones").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
