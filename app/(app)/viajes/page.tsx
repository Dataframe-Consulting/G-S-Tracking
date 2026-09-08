import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Viaje, Termografo } from "@/lib/types";
import { STATUS_CHANGE_AUDIT_PREFIX } from "@/lib/audit";
import { ViajeTable } from "@/components/Viajes/ViajeTable";

export const dynamic = "force-dynamic";

// Cuántos viajes trae la pantalla. El default cubre la operación del día a día;
// los escalones existen para consultar historial sin cargar todo de más, porque
// cada viaje arrastra sus cargas y los productos de cada una.
const ESCALONES = [200, 500] as const;
const LIMITE_DEFAULT = 200;

function parseLimite(ver?: string): number | null {
  if (ver === "todos") return null; // sin límite
  const n = Number(ver);
  return ESCALONES.includes(n as (typeof ESCALONES)[number]) ? n : LIMITE_DEFAULT;
}

export default async function ViajesPage({
  searchParams,
}: {
  searchParams?: { ver?: string };
}) {
  const supabase = createServerSupabase();
  const limite = parseLimite(searchParams?.ver);

  // Total real, para poder decir "200 de 311" en vez de un número inventado.
  const { count: totalViajes } = await supabase
    .from("viajes")
    .select("id", { count: "exact", head: true });

  const query = supabase
    .from("viajes")
    .select(`
      *,
      responsable:user_profiles!responsable_id(id, nombre, email),
      linea:lineas_transportista!linea_transportista_id ( id, nombre, concesionario:concesionarios!concesionario_id ( id, nombre ) ),
      ordenes_venta ( id, ov_ref, cliente, cedi, status, fecha_entrega, productos:orden_productos(id, producto_id, cajas, cajas_rechazadas, producto:productos(id, nombre)) )
    `)
    .order("numero", { ascending: false });

  const { data } = limite ? await query.limit(limite) : await query;

  const viajesData = (data ?? []) as Viaje[];

  // Termógrafos asignados (modelo multi, atados por viaje_id). Se cargan aparte
  // para evitar la ambigüedad de las dos relaciones viajes↔termografos.
  const viajeIds = viajesData.map((v) => v.id);
  const { data: termosData } = viajeIds.length
    ? await supabase
        .from("termografos")
        .select("id, nombre, asignado, viaje_id, ultima_actividad, deshabilitado")
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
  // y NO deshabilitado (igual que el indicador del detalle). Solo visualización; no
  // toca temp_actual ni alertas. Los deshabilitados (Cambio 1) se siguen listando en
  // termosByViaje pero no cuentan para el promedio.
  const latestPorTermo = await Promise.all(
    ((termosData ?? []) as Termografo[])
      .filter((t) => !t.deshabilitado)
      .map(async (t) => {
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
          <p className="text-sm text-brand-500 mt-0.5">
            {limite && (totalViajes ?? 0) > viajes.length
              ? `Mostrando los ${viajes.length} más recientes de ${totalViajes} viajes registrados.`
              : `${viajes.length} viaje${viajes.length === 1 ? "" : "s"} registrado${viajes.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          href="/viajes/nuevo"
          className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition shadow-sm"
        >
          + Nuevo viaje
        </Link>
      </div>
      <ViajeTable viajes={viajes} />
      <VerMas mostrando={viajes.length} total={totalViajes ?? viajes.length} verActual={searchParams?.ver} />
    </div>
  );
}

/** Escalones para ampliar cuántos viajes trae la pantalla. Navega por URL
 *  (?ver=500 / ?ver=todos) para que la vista sea compartible por link y el
 *  botón de atrás funcione. */
function VerMas({
  mostrando,
  total,
  verActual,
}: {
  mostrando: number;
  total: number;
  verActual?: string;
}) {
  if (total <= LIMITE_DEFAULT) return null;

  const actual = verActual === "todos" ? "todos" : String(parseLimite(verActual) ?? LIMITE_DEFAULT);
  const opciones: { valor: string; label: string }[] = [
    ...ESCALONES.filter((n) => n < total).map((n) => ({ valor: String(n), label: String(n) })),
    { valor: "todos", label: `Todos (${total})` },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-2 text-sm">
      <span className="text-brand-500">
        Mostrando {mostrando} de {total}. Ver:
      </span>
      {opciones.map((o) => {
        const activo = o.valor === actual;
        return (
          <Link
            key={o.valor}
            href={o.valor === String(LIMITE_DEFAULT) ? "/viajes" : `/viajes?ver=${o.valor}`}
            aria-current={activo ? "page" : undefined}
            className={
              activo
                ? "rounded-lg bg-brand-900 px-3 py-1.5 font-semibold text-white"
                : "rounded-lg border border-brand-200 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50 transition"
            }
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
