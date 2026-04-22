import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Carga } from "@/lib/types";
import { CargaTable } from "@/components/Cargas/CargaTable";

export const dynamic = "force-dynamic";

export default async function CargasPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("cargas")
    .select(`*, producto:productos ( id, nombre, temp_min, temp_max )`)
    .order("fecha_carga", { ascending: false })
    .limit(200);
  const cargas = (data ?? []) as Carga[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">Cargas</h1>
          <p className="text-sm text-brand-500 mt-0.5">Últimas 200 cargas registradas.</p>
        </div>
        <Link
          href="/cargas/nueva"
          className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 transition shadow-sm"
        >
          + Nueva carga
        </Link>
      </div>
      <CargaTable cargas={cargas} />
    </div>
  );
}
