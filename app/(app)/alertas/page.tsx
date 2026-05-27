import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { cToF } from "@/lib/temperature";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("alertas_log")
    .select(`*, viaje:viajes ( id, numero, lugar_inicio, lugar_fin )`)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows =
    (data as Array<{
      id: string;
      tipo: string;
      temperatura: number | null;
      mensaje: string | null;
      enviado_a: string | null;
      whatsapp_sid: string | null;
      created_at: string;
      viaje: { id: string; numero: number; lugar_inicio: string; lugar_fin: string } | null;
    }>) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">Alertas</h1>
        <p className="text-sm text-brand-500 mt-0.5">Últimas 100 alertas registradas.</p>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-brand-900 text-brand-50 text-xs uppercase tracking-widest">
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Temp</th>
                <th className="text-left px-4 py-3 font-medium">Viaje</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Destinatario</th>
                <th className="text-left px-4 py-3 font-medium">Envío</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-brand-400">
                    Sin alertas registradas.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className="hover:bg-brand-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-brand-500 tabular-nums whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {a.tipo === "TEMP_ALTA" ? (
                        <span className="text-red-600">🔴 ALTA</span>
                      ) : (
                        <span className="text-blue-600">🔵 BAJA</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-brand-900 tabular-nums">
                      {a.temperatura != null ? `${(cToF(Number(a.temperatura)) as number).toFixed(1)}°F` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.viaje ? (
                        <Link
                          href={`/viajes/${a.viaje.id}`}
                          className="text-brand-700 hover:text-accent transition-colors font-medium"
                        >
                          <div className="font-mono text-xs">
                            #{String(a.viaje.numero).padStart(4, "0")}
                          </div>
                          <div className="text-sm">
                            {a.viaje.lugar_inicio} → {a.viaje.lugar_fin}
                          </div>
                        </Link>
                      ) : (
                        <span className="text-brand-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-500 hidden md:table-cell">
                      {a.enviado_a ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.whatsapp_sid ? (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                          Enviado
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                          Sin envío
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div className="px-4 py-2 border-t border-brand-50 text-xs text-brand-400 text-right">
            {rows.length} alerta{rows.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
