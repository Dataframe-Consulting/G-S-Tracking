import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { CatalogoClient } from "@/components/configuracion/CatalogoClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("clientes").select("*").order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Clientes
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Directorio de clientes de la operación.
        </p>
      </div>
      <CatalogoClient
        endpoint="/api/clientes"
        initialData={data ?? []}
        fields={[
          { key: "nombre",   label: "Nombre del cliente",  placeholder: "Ej. Walmart México", primary: true },
          { key: "contacto", label: "Contacto", placeholder: "Correo, teléfono, etc.", required: false }
        ]}
      />
    </div>
  );
}
