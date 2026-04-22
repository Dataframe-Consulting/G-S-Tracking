import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogoClient } from "@/components/configuracion/CatalogoClient";

export const dynamic = "force-dynamic";

export default async function TransportistasPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("transportistas").select("*").order("nombre");

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
          Directorio de transportistas y sus contactos.
        </p>
      </div>
      <CatalogoClient
        endpoint="/api/transportistas"
        initialData={data ?? []}
        fields={[
          { key: "nombre",   label: "Nombre del transportista", placeholder: "Ej. Transportes del Norte", primary: true },
          { key: "contacto", label: "Contacto", placeholder: "Correo, teléfono, etc.", required: false }
        ]}
      />
    </div>
  );
}
