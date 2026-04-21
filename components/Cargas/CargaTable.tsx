"use client";

import Link from "next/link";
import type { Carga } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { TempIndicator } from "./TempIndicator";

export function CargaTable({ cargas }: { cargas: Carga[] }) {
  if (cargas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 bg-white">
        No hay cargas para mostrar.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2 font-medium">F. Carga</th>
            <th className="text-left px-3 py-2 font-medium">F. Entrega</th>
            <th className="text-left px-3 py-2 font-medium">Cita</th>
            <th className="text-left px-3 py-2 font-medium">Cliente</th>
            <th className="text-left px-3 py-2 font-medium">OV / REF</th>
            <th className="text-left px-3 py-2 font-medium">Lugar</th>
            <th className="text-left px-3 py-2 font-medium">Producto</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">Termógrafo</th>
            <th className="text-left px-3 py-2 font-medium">Temp</th>
            <th className="text-left px-3 py-2 font-medium">Flete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cargas.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 whitespace-nowrap">
                <Link href={`/cargas/${c.id}`} className="block">
                  {c.fecha_carga}
                </Link>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <Link href={`/cargas/${c.id}`} className="block">
                  {c.fecha_entrega}
                </Link>
              </td>
              <td className="px-3 py-2">{c.cita ?? "—"}</td>
              <td className="px-3 py-2">
                <Link href={`/cargas/${c.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                  {c.cliente}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{c.ov_ref}</td>
              <td className="px-3 py-2">{c.lugar_carga}</td>
              <td className="px-3 py-2 max-w-xs">
                <div className="truncate" title={c.producto_descripcion}>
                  {c.producto_descripcion}
                </div>
                {c.producto?.nombre && (
                  <div className="text-[11px] text-slate-500">
                    {c.producto.nombre}
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 font-mono text-xs">{c.termografo_id ?? "—"}</td>
              <td className="px-3 py-2">
                <TempIndicator
                  value={c.temp_actual}
                  min={c.producto?.temp_min}
                  max={c.producto?.temp_max}
                />
              </td>
              <td className="px-3 py-2">{c.flete_cargo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
