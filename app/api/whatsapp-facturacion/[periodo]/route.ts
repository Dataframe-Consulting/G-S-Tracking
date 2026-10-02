import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Solo master marca periodos como pagados. */
async function requireMaster(supabase: ReturnType<typeof createServerSupabase>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const, userId: null };
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = profile?.role ?? "master";
  if (role !== "master") {
    return { error: "Sin permiso para marcar pagos", status: 403 as const, userId: null };
  }
  return { error: null, status: 200 as const, userId: user.id };
}

/**
 * Marca un periodo como PAGADO o lo regresa a PENDIENTE.
 * Queda registro de quién lo marcó y cuándo.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { periodo: string } }
) {
  const supabase = createServerSupabase();
  const auth = await requireMaster(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const estado = body.estado as string | undefined;
  if (estado !== "PAGADO" && estado !== "PENDIENTE") {
    return NextResponse.json({ error: "estado debe ser PAGADO o PENDIENTE" }, { status: 400 });
  }

  const pagado = estado === "PAGADO";
  const { data, error } = await supabase
    .from("whatsapp_facturacion")
    .update({
      estado,
      // Al revertir a pendiente se limpia la firma, para no dejar un registro
      // de pago que ya no corresponde.
      pagado_at: pagado ? new Date().toISOString() : null,
      pagado_por: pagado ? auth.userId : null,
      nota: typeof body.nota === "string" ? body.nota : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("periodo", params.periodo)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Periodo no encontrado" }, { status: 404 });

  return NextResponse.json({ data });
}
