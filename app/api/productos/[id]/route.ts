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
  const { error } = await supabase.from("productos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
