"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Producto } from "@/lib/types";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

const input =
  "rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-brand-900";

export function DashboardFilters({
  fechaDesde,
  fechaHasta,
  productoId,
  productos,
}: {
  fechaDesde: string;
  fechaHasta: string;
  productoId: string;
  productos: Producto[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/dashboard?${next.toString()}`);
  }

  function updateRango(desde: string, hasta: string) {
    const next = new URLSearchParams(params.toString());
    if (desde) next.set("fecha_desde", desde);
    else next.delete("fecha_desde");
    if (hasta) next.set("fecha_hasta", hasta);
    else next.delete("fecha_hasta");
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white border border-brand-100 rounded-2xl px-4 py-3 shadow-sm">
      <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-brand-700 font-medium w-full sm:w-auto">
        Periodo
        <DateRangePicker
          desde={fechaDesde}
          hasta={fechaHasta}
          onChange={updateRango}
          clearable={false}
        />
      </label>
      <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-brand-700 font-medium w-full sm:w-auto">
        Producto
        <select
          value={productoId}
          onChange={(e) => updateParam("producto_id", e.target.value)}
          className={`${input} bg-white w-full sm:w-auto`}
        >
          <option value="">Todos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => router.push("/dashboard")}
        className="text-xs text-brand-400 hover:text-brand-700 underline underline-offset-2 transition self-start sm:self-auto"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
