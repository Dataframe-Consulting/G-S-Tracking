import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogoClient } from "@/components/configuracion/CatalogoClient";

export const dynamic = "force-dynamic";

export default async function LugaresPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("lugares_carga").select("*").order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Lugares de carga
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Puntos de origen registrados para las cargas.
        </p>
      </div>
      <CatalogoClient
        endpoint="/api/lugares"
        initialData={data ?? []}
        fields={[
          { key: "nombre", label: "Nombre del lugar", placeholder: "Ej. FRIGO NORTE", primary: true, mono: true }
        ]}
      />
    </div>
  );
}
