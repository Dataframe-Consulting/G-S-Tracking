import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto, Cliente, Transportista } from "@/lib/types";
import { CargaForm } from "@/components/Cargas/CargaForm";

export const dynamic = "force-dynamic";

export default async function NuevaCargaPage() {
  const supabase = createServerSupabase();
  const [{ data: productos }, { data: clientes }, { data: transportistas }] =
    await Promise.all([
      supabase.from("productos").select("*").order("nombre"),
      supabase.from("clientes").select("*").order("nombre"),
      supabase.from("transportistas").select("*").order("nombre"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cargas" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Cargas
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Nueva carga
        </h1>
      </div>
      <CargaForm
        productos={(productos ?? []) as Producto[]}
        clientes={(clientes ?? []) as Cliente[]}
        transportistas={(transportistas ?? []) as Transportista[]}
      />
    </div>
  );
}
