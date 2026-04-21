import { createServerSupabase } from "@/lib/supabase/server";
import { ConfiguracionForm } from "./ConfiguracionForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("config")
    .select("value")
    .eq("key", "whatsapp_destinatarios")
    .maybeSingle();

  const destinatarios = Array.isArray(data?.value) ? (data!.value as string[]) : [];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500">
          Administra los destinatarios de alertas por WhatsApp.
        </p>
      </div>
      <ConfiguracionForm initial={destinatarios} />
    </div>
  );
}
