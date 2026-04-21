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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cargas</h1>
          <p className="text-sm text-slate-500">Últimas 200 cargas registradas.</p>
        </div>
        <Link
          href="/cargas/nueva"
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + Nueva carga
        </Link>
      </div>
      <CargaTable cargas={cargas} />
    </div>
  );
}
