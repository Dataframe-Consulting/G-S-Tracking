"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Carga, Status } from "@/lib/types";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { TempIndicator } from "./TempIndicator";

function unique(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition ${
        value
          ? "border-brand-400 text-brand-900 font-medium"
          : "border-brand-200 text-brand-400"
      }`}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CargaTable({ cargas }: { cargas: Carga[] }) {
  const router = useRouter();

  const [fOvRef, setFOvRef] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fProducto, setFProducto] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fLugar, setFLugar] = useState("");
  const [fFlete, setFFlete] = useState("");

  const clientes = useMemo(() => unique(cargas.map((c) => c.cliente)), [cargas]);
  const productos = useMemo(
    () => unique(cargas.map((c) => c.producto?.nombre)),
    [cargas]
  );
  const lugares = useMemo(() => unique(cargas.map((c) => c.lugar_carga)), [cargas]);
  const fletes = useMemo(() => unique(cargas.map((c) => c.flete_cargo)), [cargas]);

  const anyFilter = fOvRef || fCliente || fFecha || fProducto || fStatus || fLugar || fFlete;

  function clearFilters() {
    setFOvRef("");
    setFCliente("");
    setFFecha("");
    setFProducto("");
    setFStatus("");
    setFLugar("");
    setFFlete("");
  }

  const filtered = useMemo(() => {
    const ovRefLower = fOvRef.toLowerCase();
    return cargas.filter((c) => {
      if (fOvRef && !c.ov_ref?.toLowerCase().includes(ovRefLower)) return false;
      if (fCliente && c.cliente !== fCliente) return false;
      if (fFecha && c.fecha_carga !== fFecha) return false;
      if (fProducto && c.producto?.nombre !== fProducto) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fLugar && c.lugar_carga !== fLugar) return false;
      if (fFlete && c.flete_cargo !== fFlete) return false;
      return true;
    });
  }, [cargas, fOvRef, fCliente, fFecha, fProducto, fStatus, fLugar, fFlete]);

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Cliente"
          value={fCliente}
          onChange={setFCliente}
          options={clientes.map((v) => ({ value: v, label: v }))}
        />
        <input
          type="text"
          value={fOvRef}
          onChange={(e) => setFOvRef(e.target.value)}
          placeholder="Buscar OV / REF…"
          className={`rounded-lg border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition w-40 ${
            fOvRef
              ? "border-brand-400 text-brand-900 font-medium"
              : "border-brand-200 text-brand-400"
          }`}
        />
        <input
          type="date"
          value={fFecha}
          onChange={(e) => setFFecha(e.target.value)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition ${
            fFecha
              ? "border-brand-400 text-brand-900 font-medium"
              : "border-brand-200 text-brand-400"
          }`}
        />
        <FilterSelect
          label="Producto"
          value={fProducto}
          onChange={setFProducto}
          options={productos.map((v) => ({ value: v, label: v }))}
        />
        <FilterSelect
          label="Estatus"
          value={fStatus}
          onChange={setFStatus}
          options={STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <FilterSelect
          label="Lugar"
          value={fLugar}
          onChange={setFLugar}
          options={lugares.map((v) => ({ value: v, label: v }))}
        />
        <FilterSelect
          label="Flete"
          value={fFlete}
          onChange={setFFlete}
          options={fletes.map((v) => ({ value: v, label: v }))}
        />
        {anyFilter && (
          <button
            onClick={clearFilters}
            className="text-xs text-brand-400 hover:text-brand-700 underline underline-offset-2 transition"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 p-12 text-center bg-white">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-display font-semibold text-brand-900 text-lg">Sin resultados</div>
          <div className="text-sm text-brand-500 mt-1">
            No hay cargas que coincidan con los filtros aplicados.
          </div>
        </div>
      ) : (
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
                {filtered.map((c) => (
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
                      {c.cita && <div className="text-xs text-brand-400">{c.cita}</div>}
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
            {anyFilter ? (
              <>
                <span className="text-brand-700 font-medium">{filtered.length}</span> de {cargas.length} carga{cargas.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>{cargas.length} carga{cargas.length !== 1 ? "s" : ""}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
