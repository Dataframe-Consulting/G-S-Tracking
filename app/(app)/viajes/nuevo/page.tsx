import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { ViajeForm } from "@/components/Viajes/ViajeForm";

export const dynamic = "force-dynamic";

export default async function NuevoViajePage() {
  const supabase = createServerSupabase();
  // El flete/transportista se elige entre los concesionarios (Ferraris, Roberto López, …),
  // no la tabla legacy `transportistas`. Solo se muestran los nombres (no las líneas).
  const [{ data: concesionarios }, { data: usuarios }] = await Promise.all([
    supabase.from("concesionarios").select("id, nombre").order("nombre"),
    supabase.from("user_profiles").select("user_id, nombre, email").order("nombre"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/viajes" className="text-sm text-brand-500 hover:text-brand-900 transition font-medium">
          ← Viajes
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          Nuevo viaje
        </h1>
      </div>
      <ViajeForm
        transportistas={(concesionarios ?? []) as { id: string; nombre: string }[]}
        usuarios={(usuarios ?? []) as { user_id: string; nombre: string | null; email: string | null }[]}
      />
    </div>
  );
}
