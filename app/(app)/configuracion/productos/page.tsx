import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto } from "@/lib/types";
import { ProductosClient } from "@/components/configuracion/ProductosClient";
import type { Combinacion } from "@/components/configuracion/ProductosClient";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const supabase = createServerSupabase();
  const [{ data: productos }, { data: combinaciones }] = await Promise.all([
    supabase.from("productos").select("*").order("nombre"),
    supabase
      .from("producto_combinaciones")
      .select(`*, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)`)
      .order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Productos
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Catálogo de productos con rangos de temperatura permitidos.
        </p>
      </div>
      <ProductosClient
        productos={(productos ?? []) as Producto[]}
        combinaciones={(combinaciones ?? []) as Combinacion[]}
      />
    </div>
  );
}
