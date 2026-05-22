import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.nombre   !== undefined) updates.nombre   = body.nombre;
  if (body.temp_min !== undefined) updates.temp_min = Number(body.temp_min);
  if (body.temp_max !== undefined) updates.temp_max = Number(body.temp_max);
  if (updates.temp_min !== undefined && updates.temp_max !== undefined && Number(updates.temp_min) >= Number(updates.temp_max))
    return NextResponse.json({ error: "Temp mínima debe ser menor a la máxima" }, { status: 400 });
  const { data, error } = await supabase.from("productos").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const id = params.id;

  const [{ count: ordenesCount }, { count: combosCount }] = await Promise.all([
    supabase.from("ordenes_venta").select("id", { count: "exact", head: true }).eq("producto_id", id),
    supabase.from("producto_combinaciones").select("id", { count: "exact", head: true }).or(`producto_a_id.eq.${id},producto_b_id.eq.${id}`),
  ]);

  const motivos: string[] = [];
  if (ordenesCount && ordenesCount > 0)
    motivos.push(`${ordenesCount} orden${ordenesCount !== 1 ? "es" : ""} de venta`);
  if (combosCount && combosCount > 0)
    motivos.push(`${combosCount} combinación${combosCount !== 1 ? "es" : ""} de producto`);

  if (motivos.length > 0)
    return NextResponse.json(
      { error: `No se puede eliminar: el producto está en uso en ${motivos.join(" y ")}.` },
      { status: 409 }
    );

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
