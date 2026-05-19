import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { ClientesConCedisClient } from "@/components/configuracion/ClientesConCedisClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("clientes")
    .select("*, cedis(*)")
    .order("nombre");

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
          Directorio de clientes y sus centros de distribución (cedis).
        </p>
      </div>
      <ClientesConCedisClient initialData={data ?? []} />
    </div>
  );
}
