import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AlertaLog, Carga, LecturaTemperatura } from "@/lib/types";
import { CargaDetail } from "@/components/Cargas/CargaDetail";

export const dynamic = "force-dynamic";

export default async function CargaDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: carga } = await supabase
    .from("cargas")
    .select(`*, producto:productos ( id, nombre, temp_min, temp_max )`)
    .eq("id", params.id)
    .maybeSingle();

  if (!carga) notFound();

  const [{ data: lecturas }, { data: alertas }] = await Promise.all([
    supabase
      .from("lecturas_temperatura")
      .select("*")
      .eq("carga_id", params.id)
      .order("timestamp", { ascending: false })
      .limit(50),
    supabase
      .from("alertas_log")
      .select("*")
      .eq("carga_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <div className="space-y-4">
      <Link href="/cargas" className="text-sm text-slate-500 hover:text-slate-700">
        ← Cargas
      </Link>
      <CargaDetail
        carga={carga as Carga}
        lecturas={(lecturas ?? []) as LecturaTemperatura[]}
        alertas={(alertas ?? []) as AlertaLog[]}
      />
    </div>
  );
}
