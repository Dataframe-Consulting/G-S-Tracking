"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Carga } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { TempIndicator } from "./TempIndicator";

export function CargaTable({ cargas }: { cargas: Carga[] }) {
  const router = useRouter();
  if (cargas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-200 p-12 text-center bg-white">
        <div className="text-4xl mb-3">📦</div>
        <div className="font-display font-semibold text-brand-900 text-lg">Sin cargas</div>
        <div className="text-sm text-brand-500 mt-1">No hay cargas para mostrar en esta fecha.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-brand-900 text-brand-50 text-xs uppercase tracking-widest">
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">OV / REF</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">F. Carga</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">F. Entrega</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Producto</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Termógrafo</th>
              <th className="text-left px-4 py-3 font-medium">Temp</th>
              <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Lugar</th>
              <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Flete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {cargas.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/cargas/${c.id}`)}
                className="hover:bg-brand-50/60 transition-colors group cursor-pointer"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/cargas/${c.id}`}
                    className="font-semibold text-brand-900 group-hover:text-brand-700 transition-colors"
                  >
                    {c.cliente}
                  </Link>
                  {/* Mobile-only secondary info */}
                  <div className="sm:hidden text-xs text-brand-500 font-mono mt-0.5">{c.ov_ref}</div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                    {c.ov_ref}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-brand-600 tabular-nums">
                  {c.fecha_carga}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-brand-600 tabular-nums">
                  {c.fecha_entrega}
                  {c.cita && (
                    <div className="text-xs text-brand-400">{c.cita}</div>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                  <div className="truncate text-brand-700" title={c.producto_descripcion}>
                    {c.producto_descripcion}
                  </div>
                  {c.producto?.nombre && (
                    <div className="text-xs text-brand-400 mt-0.5">{c.producto.nombre}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-brand-500">
                  {c.termografo_id ?? <span className="text-brand-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <TempIndicator
                    value={c.temp_actual}
                    min={c.producto?.temp_min}
                    max={c.producto?.temp_max}
                  />
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-brand-500 text-xs">
                  {c.lugar_carga}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell text-brand-500 text-xs">
                  {c.flete_cargo ?? <span className="text-brand-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-brand-50 text-xs text-brand-400 text-right">
        {cargas.length} carga{cargas.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
