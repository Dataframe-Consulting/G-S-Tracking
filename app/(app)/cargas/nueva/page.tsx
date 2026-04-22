import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto } from "@/lib/types";
import { CargaForm } from "@/components/Cargas/CargaForm";

export const dynamic = "force-dynamic";

export default async function NuevaCargaPage() {
  const supabase = createServerSupabase();
  const { data: productos } = await supabase.from("productos").select("*").order("nombre");

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/cargas" className="text-sm text-slate-500 hover:text-slate-700">
          ← Cargas
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Nueva carga</h1>
      </div>
      <CargaForm productos={(productos ?? []) as Producto[]} />
    </div>
  );
}
