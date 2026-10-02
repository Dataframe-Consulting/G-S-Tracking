import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { WhatsAppCostosClient } from "@/components/configuracion/WhatsAppCostosClient";
import type { WhatsAppFacturacion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WhatsAppCostosPage() {
  const supabase = createServerSupabase();

  // Los costos son solo para master.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("user_profiles").select("role").eq("user_id", user.id).maybeSingle()
    : { data: null };
  if ((profile?.role ?? "master") !== "master") redirect("/configuracion");

  const { data: periodos } = await supabase
    .from("whatsapp_facturacion")
    .select("*")
    .order("periodo", { ascending: false });

  // Nombre de quien marcó cada pago.
  const ids = [...new Set((periodos ?? []).map((p) => p.pagado_por).filter(Boolean))] as string[];
  const nombres: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: perfiles } = await supabase
      .from("user_profiles")
      .select("user_id, nombre, email")
      .in("user_id", ids);
    for (const p of perfiles ?? []) {
      nombres[p.user_id as string] = (p.nombre as string) ?? (p.email as string) ?? "—";
    }
  }

  const filas = ((periodos ?? []) as WhatsAppFacturacion[]).map((p) => ({
    ...p,
    pagado_por_nombre: p.pagado_por ? nombres[p.pagado_por] ?? "—" : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/configuracion"
          className="text-sm text-brand-500 hover:text-brand-900 transition font-medium"
        >
          ← Configuración
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight mt-1">
          WhatsApp
        </h1>
        <p className="text-sm text-brand-500 mt-0.5">
          Costo mensual de los mensajes de alerta y control de pagos a Meta.
        </p>
      </div>
      <WhatsAppCostosClient periodos={filas} />
    </div>
  );
}
