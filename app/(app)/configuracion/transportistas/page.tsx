import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { ConcesionariosClient } from "@/components/configuracion/ConcesionariosClient";

export const dynamic = "force-dynamic";

export default async function TransportistasPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("concesionarios")
    .select("*, lineas_transportista(*)")
    .order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Transportistas
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Catálogo de concesionarios y sus líneas transportistas.
        </p>
      </div>
      <ConcesionariosClient initialData={data ?? []} />
    </div>
  );
}
