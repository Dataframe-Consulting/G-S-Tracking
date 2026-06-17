import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Viaje, Termografo } from "@/lib/types";
import { STATUS_CHANGE_AUDIT_PREFIX } from "@/lib/audit";
import { ViajeTable } from "@/components/Viajes/ViajeTable";

export const dynamic = "force-dynamic";

export default async function ViajesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("viajes")
    .select(`
      *,
      responsable:user_profiles!responsable_id(id, nombre, email),
      linea:lineas_transportista!linea_transportista_id ( id, nombre, concesionario:concesionarios!concesionario_id ( id, nombre ) ),
      ordenes_venta ( id, ov_ref, cliente, cedi, status, fecha_entrega, productos:orden_productos(id, producto_id, cajas, producto:productos(id, nombre)) )
    `)
    .order("numero", { ascending: false })
    .limit(200);

  const viajesData = (data ?? []) as Viaje[];

  // Termógrafos asignados (modelo multi, atados por viaje_id). Se cargan aparte
  // para evitar la ambigüedad de las dos relaciones viajes↔termografos.
  const viajeIds = viajesData.map((v) => v.id);
  const { data: termosData } = viajeIds.length
    ? await supabase
        .from("termografos")
        .select("id, nombre, asignado, viaje_id, ultima_actividad")
        .eq("asignado", true)
        .in("viaje_id", viajeIds)
    : { data: [] as Termografo[] };

  const termosByViaje = new Map<string, Termografo[]>();
  for (const t of (termosData ?? []) as Termografo[]) {
    if (!t.viaje_id) continue;
    const list = termosByViaje.get(t.viaje_id) ?? [];
    list.push(t);
    termosByViaje.set(t.viaje_id, list);
  }

  // Temperatura de carga = promedio de la última lectura de cada termógrafo asignado
  // (igual que el indicador del detalle). Solo visualización; no toca temp_actual ni alertas.
  const latestPorTermo = await Promise.all(
    ((termosData ?? []) as Termografo[]).map(async (t) => {
      const { data } = await supabase
        .from("lecturas_temperatura")
        .select("temperatura")
        .eq("viaje_id", t.viaje_id as string)
        .eq("termografo_id", t.id)
        .order("timestamp", { ascending: false })
        .limit(1);
      return {
        viaje_id: t.viaje_id as string,
        temp: data?.[0]?.temperatura != null ? Number(data[0].temperatura) : null,
      };
    })
  );
  const tempAcc = new Map<string, { sum: number; n: number }>();
  for (const r of latestPorTermo) {
    if (r.temp == null) continue;
    const a = tempAcc.get(r.viaje_id) ?? { sum: 0, n: 0 };
    a.sum += r.temp;
    a.n += 1;
    tempAcc.set(r.viaje_id, a);
  }

  // concluido_at (calculado, no en BD): fecha del último cambio de status de cada
  // viaje, leída del histórico de auditoría (inmutable, no se mueve al editar otros
  // campos). Sirve para ordenar Completados/Rechazados por cuándo concluyeron.
  const concluidoAt = new Map<string, string>();
  if (viajeIds.length) {
    const { data: statusAudit } = await supabase
      .from("auditoria")
      .select("viaje_id, created_at")
      .in("viaje_id", viajeIds)
      .ilike("descripcion", `${STATUS_CHANGE_AUDIT_PREFIX}%`)
      .order("created_at", { ascending: true });
    // Orden ascendente → el último registro por viaje gana = el cambio más reciente.
    for (const a of statusAudit ?? []) {
      if (a.viaje_id) concluidoAt.set(a.viaje_id, a.created_at as string);
    }
  }

  const viajes: Viaje[] = viajesData.map((v) => {
    const acc = tempAcc.get(v.id);
    return {
      ...v,
      termografos: termosByViaje.get(v.id) ?? [],
      temp_carga: acc ? acc.sum / acc.n : null,
      concluido_at: concluidoAt.get(v.id) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">Viajes</h1>
          <p className="text-sm text-brand-500 mt-0.5">Últimos 200 viajes registrados.</p>
        </div>
        <Link
          href="/viajes/nuevo"
          className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition shadow-sm"
        >
          + Nuevo viaje
        </Link>
      </div>
      <ViajeTable viajes={viajes} />
    </div>
  );
}
