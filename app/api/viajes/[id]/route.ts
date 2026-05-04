import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("viajes")
    .select(`*, responsable:user_profiles!responsable_id(id, nombre, email), ordenes_venta ( *, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)) )`)
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data: prev } = await supabase
    .from("viajes")
    .select("termografo_id")
    .eq("id", params.id)
    .single();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "lugar_inicio",
    "lugar_fin",
    "fecha_inicio",
    "fecha_fin",
    "flete_cargo",
    "termografo_id",
    "responsable_id",
  ];
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await supabase
    .from("viajes")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if ("termografo_id" in body && body.termografo_id !== prev?.termografo_id) {
    if (prev?.termografo_id) {
      await supabase
        .from("termografos")
        .update({ asignado: false, viaje_id: null })
        .eq("id", prev.termografo_id);
    }
    if (body.termografo_id) {
      await supabase
        .from("termografos")
        .update({ asignado: true, viaje_id: data.id })
        .eq("id", body.termografo_id);
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: prev } = await supabase
    .from("viajes")
    .select("termografo_id")
    .eq("id", params.id)
    .single();
  const { error } = await supabase.from("viajes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (prev?.termografo_id) {
    await supabase
      .from("termografos")
      .update({ asignado: false, viaje_id: null })
      .eq("id", prev.termografo_id);
  }
  return NextResponse.json({ ok: true });
}
