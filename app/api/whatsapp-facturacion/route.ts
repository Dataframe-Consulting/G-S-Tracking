import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { obtenerCostosMeta, inicioMesEpoch, finMesEpoch } from "@/lib/metaBilling";

// Consultar Meta toma unos segundos (dos llamadas a la Graph API).
export const maxDuration = 60;

// El primer mes con alertas enviadas por Meta Cloud API.
const PERIODO_INICIAL = "2026-07";

/** Solo master ve y toca los costos. */
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
  // Sin perfil = fallback de desarrollo (se trata como master), igual que en usuarios.
  const role = profile?.role ?? "master";
  if (role !== "master") {
    return { error: "Sin permiso para ver costos", status: 403 as const, userId: null };
  }
  return { error: null, status: 200 as const, userId: user.id };
}

export async function GET() {
  const supabase = createServerSupabase();
  const auth = await requireMaster(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabase
    .from("whatsapp_facturacion")
    .select("*")
    .order("periodo", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nombre de quien marcó cada periodo como pagado, para mostrarlo en la tabla.
  const ids = [...new Set((data ?? []).map((r) => r.pagado_por).filter(Boolean))] as string[];
  const nombres: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: perfiles } = await supabase
      .from("user_profiles")
      .select("user_id, nombre, email")
      .in("user_id", ids);
    for (const p of perfiles ?? []) {
      nombres[p.user_id as string] = (p.nombre as string) ?? (p.email as string) ?? "—";
    }
  }

  return NextResponse.json({
    data: (data ?? []).map((r) => ({
      ...r,
      pagado_por_nombre: r.pagado_por ? nombres[r.pagado_por as string] ?? "—" : null,
    })),
  });
}

/**
 * Sincroniza desde Meta. Es manual (botón en la UI) porque el mes en curso cambia
 * todo el tiempo y no tiene sentido escribirlo en cada corrida del cron.
 *
 * Los periodos ya marcados como PAGADO NO se tocan: su cifra queda congelada con
 * lo que se facturó en su momento.
 */
export async function POST() {
  const supabase = createServerSupabase();
  const auth = await requireMaster(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let periodos;
  try {
    periodos = await obtenerCostosMeta(PERIODO_INICIAL);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error consultando Meta" },
      { status: 502 }
    );
  }

  const { data: pagados } = await supabase
    .from("whatsapp_facturacion")
    .select("periodo")
    .eq("estado", "PAGADO");
  const congelados = new Set((pagados ?? []).map((p) => p.periodo as string));

  const ahora = new Date().toISOString();
  let actualizados = 0;

  for (const p of periodos) {
    if (congelados.has(p.periodo)) continue;

    // `enviados` sale de NUESTRO registro, no del de Meta. Meta solo cuenta como
    // enviados los que efectivamente mandó, así que su cifra siempre empata con
    // la de entregados y nunca mostraría una brecha. La diferencia que importa es
    // cuántos intentó mandar AgroTrack contra cuántos salieron de verdad: en
    // septiembre fueron 7,498 contra 5,255, y esos 2,243 son la huella del
    // bloqueo de la cuenta por adeudo.
    const { count: enviadosNuestros } = await supabase
      .from("alertas_log")
      .select("id", { count: "exact", head: true })
      .not("whatsapp_sid", "is", null)
      .gte("created_at", new Date(inicioMesEpoch(p.periodo) * 1000).toISOString())
      .lt("created_at", new Date(finMesEpoch(p.periodo) * 1000).toISOString());

    const { error } = await supabase.from("whatsapp_facturacion").upsert(
      {
        periodo: p.periodo,
        mensajes: p.mensajes,
        costo_mxn: p.costo,
        enviados: enviadosNuestros ?? null,
        sincronizado_at: ahora,
        updated_at: ahora,
      },
      { onConflict: "periodo" }
    );
    if (!error) actualizados++;
  }

  return NextResponse.json({ ok: true, actualizados, congelados: congelados.size });
}
