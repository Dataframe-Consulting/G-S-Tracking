import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogoClient } from "@/components/configuracion/CatalogoClient";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("productos").select("*").order("nombre");

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
      <CatalogoClient
        endpoint="/api/productos"
        initialData={data ?? []}
        fields={[
          { key: "nombre",   label: "Nombre del producto", placeholder: "Ej. Aguacate Orgánico", primary: true },
          { key: "temp_min", label: "Temp. mínima (°C)", placeholder: "0",  type: "number" },
          { key: "temp_max", label: "Temp. máxima (°C)", placeholder: "10", type: "number" }
        ]}
      />
    </div>
  );
}
