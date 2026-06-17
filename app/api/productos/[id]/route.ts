import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.nombre !== undefined) updates.nombre = body.nombre;
  const { data, error } = await supabase.from("productos").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const id = params.id;

  // En uso si aparece en alguna OV (orden_productos, Fase 5).
  const { count } = await supabase
    .from("orden_productos")
    .select("id", { count: "exact", head: true })
    .eq("producto_id", id);

  if (count && count > 0)
    return NextResponse.json(
      { error: `No se puede eliminar: el producto está en uso en ${count} orden${count !== 1 ? "es" : ""} de venta.` },
      { status: 409 }
    );

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
