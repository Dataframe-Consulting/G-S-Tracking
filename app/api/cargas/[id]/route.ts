import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cargas")
    .select(`*, producto:productos ( id, nombre, temp_min, temp_max )`)
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const { data: prev } = await supabase
    .from("cargas")
    .select("termografo_id")
    .eq("id", params.id)
    .single();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "fecha_carga",
    "fecha_entrega",
    "cita",
    "cliente",
    "ov_ref",
    "lugar_carga",
    "producto_descripcion",
    "producto_id",
    "status",
    "flete_cargo",
    "termografo_id"
  ];
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await supabase
    .from("cargas")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Handle termografo reassignment
  if ("termografo_id" in body && body.termografo_id !== prev?.termografo_id) {
    if (prev?.termografo_id) {
      await supabase
        .from("termografos")
        .update({ asignado: false, carga_id: null })
        .eq("id", prev.termografo_id);
    }
    if (body.termografo_id) {
      await supabase
        .from("termografos")
        .update({ asignado: true, carga_id: data.id })
        .eq("id", body.termografo_id);
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: prev } = await supabase
    .from("cargas")
    .select("termografo_id")
    .eq("id", params.id)
    .single();
  const { error } = await supabase.from("cargas").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (prev?.termografo_id) {
    await supabase
      .from("termografos")
      .update({ asignado: false, carga_id: null })
      .eq("id", prev.termografo_id);
  }
  return NextResponse.json({ ok: true });
}
