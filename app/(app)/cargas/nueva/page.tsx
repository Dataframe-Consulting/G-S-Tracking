import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto, Cliente, Transportista, ProductoCombinacion } from "@/lib/types";
import { CargaForm } from "@/components/Cargas/CargaForm";

export const dynamic = "force-dynamic";

export default async function NuevaCargaPage() {
  const supabase = createServerSupabase();
  const [{ data: productos }, { data: clientes }, { data: transportistas }, { data: combinaciones }] =
    await Promise.all([
      supabase.from("productos").select("*").order("nombre"),
      supabase.from("clientes").select("*").order("nombre"),
      supabase.from("transportistas").select("*").order("nombre"),
      supabase
        .from("producto_combinaciones")
        .select(`*, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)`)
        .order("created_at"),
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
        combinaciones={(combinaciones ?? []) as ProductoCombinacion[]}
      />
    </div>
  );
}
