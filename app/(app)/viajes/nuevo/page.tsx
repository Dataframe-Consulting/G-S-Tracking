import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Transportista } from "@/lib/types";
import { ViajeForm } from "@/components/Viajes/ViajeForm";

export const dynamic = "force-dynamic";

export default async function NuevoViajePage() {
  const supabase = createServerSupabase();
  const [{ data: transportistas }, { data: usuarios }] = await Promise.all([
    supabase.from("transportistas").select("*").order("nombre"),
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
        transportistas={(transportistas ?? []) as Transportista[]}
        usuarios={(usuarios ?? []) as { user_id: string; nombre: string | null; email: string | null }[]}
      />
    </div>
  );
}
