import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Carga } from "@/lib/types";
import { CargaTable } from "@/components/Cargas/CargaTable";
import { KpiCards } from "@/components/Dashboard/KpiCards";
import { DashboardFilters } from "./Filters";
import { DashboardLive } from "./Live";

export const dynamic = "force-dynamic";

function today() {
  const d = new Date();
  const mx = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return mx.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { fecha?: string; status?: string };
}) {
  const supabase = createServerSupabase();
  const fecha = searchParams.fecha ?? today();
  const status = searchParams.status ?? "";

  let q = supabase
    .from("cargas")
    .select(`*, producto:productos ( id, nombre, temp_min, temp_max )`)
    .eq("fecha_carga", fecha)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data } = await q;
  const cargas = (data ?? []) as Carga[];

  const total = cargas.length;
  const enTransito = cargas.filter((c) => c.status === "TRANSITO").length;
  const alertas = cargas.filter((c) => c.alerta_activa).length;
  const entregadas = cargas.filter(
    (c) => c.status === "ENTREGADO" || c.status === "RECIBIDO"
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Operación diaria — visualiza temperatura, ubicación y alertas en tiempo real.
          </p>
        </div>
        <Link
          href="/cargas/nueva"
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + Nueva carga
        </Link>
      </div>

      <KpiCards
        total={total}
        enTransito={enTransito}
        alertas={alertas}
        entregadas={entregadas}
      />

      <DashboardFilters fecha={fecha} status={status} />

      <CargaTable cargas={cargas} />

      <DashboardLive />
    </div>
  );
}
