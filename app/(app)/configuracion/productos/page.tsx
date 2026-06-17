import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto } from "@/lib/types";
import { ProductosClient } from "@/components/configuracion/ProductosClient";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const supabase = createServerSupabase();
  const { data: productos } = await supabase.from("productos").select("*").order("nombre");

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
          Catálogo de productos.
        </p>
      </div>
      <ProductosClient productos={(productos ?? []) as Producto[]} />
    </div>
  );
}
