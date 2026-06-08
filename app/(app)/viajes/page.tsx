import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Viaje, Termografo } from "@/lib/types";
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
      ordenes_venta ( id, ov_ref, cliente, cedi, status, fecha_entrega, producto_id, producto_combinacion_id, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id,nombre), producto_b:productos!producto_b_id(id,nombre)) )
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

  const viajes: Viaje[] = viajesData.map((v) => ({
    ...v,
    termografos: termosByViaje.get(v.id) ?? [],
  }));

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
