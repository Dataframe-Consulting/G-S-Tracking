import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const VIAJE_SELECT = `
  *,
  responsable:user_profiles!responsable_id(id, nombre, email),
  ordenes_venta ( id, ov_ref, cliente, status, producto_id, producto:productos(id, nombre, temp_min, temp_max) )
`;

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("viajes")
    .select(VIAJE_SELECT)
    .order("numero", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const required = ["lugar_inicio", "lugar_fin", "fecha_inicio", "fecha_fin"];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `Falta ${k}` }, { status: 400 });
  }

  const payload = {
    lugar_inicio: body.lugar_inicio,
    lugar_fin: body.lugar_fin,
    fecha_inicio: body.fecha_inicio,
    fecha_fin: body.fecha_fin,
    flete_cargo: body.flete_cargo ?? null,
    termografo_id: body.termografo_id ?? null,
    responsable_id: body.responsable_id ?? null,
  };

  const { data, error } = await supabase
    .from("viajes")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data.termografo_id) {
    await supabase
      .from("termografos")
      .update({ asignado: true, viaje_id: data.id })
      .eq("id", data.termografo_id);
  }

  await logAudit(supabase, {
    viaje_id: data.id,
    tipo: "CREACION",
    descripcion: `Creó viaje ${data.lugar_inicio} → ${data.lugar_fin}`,
  });

  return NextResponse.json({ data }, { status: 201 });
}
