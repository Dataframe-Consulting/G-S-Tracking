import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Termografo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TermografosPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("termografos").select("*").order("id");
  const termografos = (data ?? []) as Termografo[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Termógrafos</h1>
        <p className="text-sm text-slate-500">Inventario de dispositivos Copeland.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Viaje asignado</th>
              <th className="text-left px-3 py-2">Última actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {termografos.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-mono">{t.id}</td>
                <td className="px-3 py-2">{t.nombre ?? "—"}</td>
                <td className="px-3 py-2">
                  {t.asignado ? (
                    <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs">
                      Asignado
                    </span>
                  ) : (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs">
                      Disponible
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {t.viaje_id ? (
                    <Link href={`/viajes/${t.viaje_id}`} className="text-brand-700 hover:underline">
                      {t.viaje_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {t.ultima_actividad
                    ? new Date(t.ultima_actividad).toLocaleString("es-MX")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
