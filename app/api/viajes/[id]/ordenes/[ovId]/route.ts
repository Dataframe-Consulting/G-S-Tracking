import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_VALUES, STATUS_LABELS, type Status } from "@/lib/types";
import { logAudit, logAuditMany } from "@/lib/audit";
import { to12h } from "@/lib/time";

const OV_FIELD_LABELS: Record<string, string> = {
  ov_ref: "OV/REF",
  cliente: "cliente",
  cedi: "cedi",
  fecha_carga: "fecha de carga",
  lugar_carga: "lugar de carga",
  fecha_entrega: "fecha de entrega",
  lugar_entrega: "lugar de entrega",
  cita: "cita",
  instrucciones: "instrucciones",
  cajas: "cajas",
  cajas_b: "cajas (B)",
};

function statusLabel(value: unknown): string {
  return STATUS_LABELS[value as Status] ?? String(value ?? "(vacío)");
}

function fmtOV(campo: string, value: unknown): string {
  if (value == null || value === "") return "(vacío)";
  if (campo === "cita") return to12h(value as string) ?? String(value);
  return String(value);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; ovId: string } }
) {
  const supabase = createServerSupabase();
  const body = await req.json();

  if (body.status && !STATUS_VALUES.includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const { data: prev } = await supabase
    .from("ordenes_venta")
    .select(
      "ov_ref, cliente, cedi, fecha_carga, lugar_carga, fecha_entrega, lugar_entrega, cita, status, instrucciones, producto_id, producto_combinacion_id, cajas, cajas_b"
    )
    .eq("id", params.ovId)
    .eq("viaje_id", params.id)
    .single();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "ov_ref",
    "cliente",
    "cedi",
    "fecha_carga",
    "lugar_carga",
    "fecha_entrega",
    "lugar_entrega",
    "cita",
    "status",
    "instrucciones",
    "producto_id",
    "producto_combinacion_id",
    "cajas",
    "cajas_b",
  ];
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { data, error } = await supabase
    .from("ordenes_venta")
    .update(update)
    .eq("id", params.ovId)
    .eq("viaje_id", params.id)
    .select(`*, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre))`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auditoría: una entrada por campo que realmente cambió
  if (prev) {
    const ref = data.ov_ref;
    const descripciones: string[] = [];

    if ("status" in body && prev.status !== data.status) {
      descripciones.push(
        `Cambió status de OV ${ref} de ${statusLabel(prev.status)} a ${statusLabel(data.status)}`
      );
    }

    const productoCambio =
      ("producto_id" in body && (prev.producto_id ?? null) !== (data.producto_id ?? null)) ||
      ("producto_combinacion_id" in body &&
        (prev.producto_combinacion_id ?? null) !== (data.producto_combinacion_id ?? null));
    if (productoCambio) {
      descripciones.push(`Cambió producto de OV ${ref}`);
    }

    for (const campo of Object.keys(OV_FIELD_LABELS)) {
      if (!(campo in body)) continue;
      const antes = (prev as Record<string, unknown>)[campo] ?? null;
      const despues = (data as Record<string, unknown>)[campo] ?? null;
      if (antes === despues) continue;

      const label = OV_FIELD_LABELS[campo];
      if (campo === "instrucciones") {
        descripciones.push(`Editó instrucciones de OV ${ref}`);
      } else {
        descripciones.push(
          `Cambió ${label} de OV ${ref} de ${fmtOV(campo, antes)} a ${fmtOV(campo, despues)}`
        );
      }
    }

    await logAuditMany(
      supabase,
      { viaje_id: params.id, ov_id: params.ovId, tipo: "MODIFICACION" },
      descripciones
    );
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; ovId: string } }
) {
  const supabase = createServerSupabase();

  const { data: prev } = await supabase
    .from("ordenes_venta")
    .select("ov_ref")
    .eq("id", params.ovId)
    .eq("viaje_id", params.id)
    .single();

  const { error } = await supabase
    .from("ordenes_venta")
    .delete()
    .eq("id", params.ovId)
    .eq("viaje_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit(supabase, {
    viaje_id: params.id,
    tipo: "MODIFICACION",
    descripcion: `Eliminó OV ${prev?.ov_ref ?? params.ovId}`,
  });

  return NextResponse.json({ ok: true });
}
