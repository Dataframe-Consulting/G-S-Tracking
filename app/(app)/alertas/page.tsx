import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("alertas_log")
    .select(`*, carga:cargas ( id, ov_ref, cliente )`)
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
      carga: { id: string; ov_ref: string; cliente: string } | null;
    }>) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alertas</h1>
        <p className="text-sm text-slate-500">Últimas 100 alertas registradas.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Temp</th>
              <th className="text-left px-3 py-2">Carga</th>
              <th className="text-left px-3 py-2">Destinatario</th>
              <th className="text-left px-3 py-2">Estado envío</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                  Sin alertas registradas.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(a.created_at).toLocaleString("es-MX")}
                  </td>
                  <td className="px-3 py-2">
                    {a.tipo === "TEMP_ALTA" ? "🔴 ALTA" : "🔵 BAJA"}
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {a.temperatura != null ? `${Number(a.temperatura).toFixed(1)}°C` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.carga ? (
                      <Link href={`/cargas/${a.carga.id}`} className="text-brand-700 hover:underline">
                        {a.carga.ov_ref} · {a.carga.cliente}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.enviado_a ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.whatsapp_sid ? (
                      <span className="text-emerald-700">Enviado</span>
                    ) : (
                      <span className="text-amber-700">Sin envío</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
