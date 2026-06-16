import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Producto, RangoTemperatura } from "@/lib/types";
import { RangosClient } from "@/components/configuracion/RangosClient";

export const dynamic = "force-dynamic";

export default async function TemperaturasPage() {
  const supabase = createServerSupabase();
  const [{ data: rangos }, { data: productos }] = await Promise.all([
    supabase
      .from("rangos_temperatura")
      .select(`*, productos:productos!rango_id(id, nombre)`)
      .order("temp_min", { ascending: true }),
    supabase.from("productos").select("id, nombre, rango_id").order("nombre"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Temperaturas
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Catálogo de rangos de temperatura y los productos que pertenecen a cada uno.
        </p>
      </div>
      <RangosClient
        rangos={(rangos ?? []) as RangoTemperatura[]}
        productos={(productos ?? []) as Producto[]}
      />
    </div>
  );
}
