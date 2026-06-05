import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AlertaLog, Auditoria, LecturaTemperatura, Termografo, Viaje } from "@/lib/types";
import { ViajeDetail } from "@/components/Viajes/ViajeDetail";

export const dynamic = "force-dynamic";

export default async function ViajeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: viaje } = await supabase
    .from("viajes")
    .select(`*, responsable:user_profiles!responsable_id(id, nombre, email), linea:lineas_transportista!linea_transportista_id ( id, nombre, concesionario:concesionarios!concesionario_id ( id, nombre ) ), ordenes_venta ( *, producto:productos(id, nombre, temp_min, temp_max), combo:producto_combinaciones!producto_combinacion_id(id, temp_min, temp_max, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)) )`)
    .eq("id", params.id)
    .maybeSingle();

  if (!viaje) notFound();

  const [{ data: lecturas }, { data: alertas }, { data: termografos }, { data: auditoria }] =
    await Promise.all([
      supabase
        .from("lecturas_temperatura")
        .select("*")
        .eq("viaje_id", params.id)
        .order("timestamp", { ascending: false })
        .limit(150),
      supabase
        .from("alertas_log")
        .select("*")
        .eq("viaje_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("termografos")
        .select("*")
        .eq("viaje_id", params.id)
        .eq("asignado", true),
      supabase
        .from("auditoria")
        .select("*")
        .eq("viaje_id", params.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  return (
    <div className="space-y-4">
      <Link href="/viajes" className="text-sm text-slate-500 hover:text-slate-700">
        ← Viajes
      </Link>
      <ViajeDetail
        viaje={viaje as Viaje}
        lecturas={(lecturas ?? []) as LecturaTemperatura[]}
        alertas={(alertas ?? []) as AlertaLog[]}
        termografos={(termografos ?? []) as Termografo[]}
        auditoria={(auditoria ?? []) as Auditoria[]}
      />
    </div>
  );
}
