import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Viaje } from "@/lib/types";
import { ViajeTable } from "@/components/Viajes/ViajeTable";

export const dynamic = "force-dynamic";

export default async function ViajesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("viajes")
    .select(`
      *,
      responsable:user_profiles!responsable_id(id, nombre, email),
      ordenes_venta ( id, ov_ref, cliente, status, producto_id, producto:productos(id, nombre, temp_min, temp_max) )
    `)
    .order("numero", { ascending: false })
    .limit(200);

  const viajes = (data ?? []) as Viaje[];

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
