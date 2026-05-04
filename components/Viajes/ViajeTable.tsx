"use client";

import Link from "next/link";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Viaje } from "@/lib/types";
import { TempIndicator } from "@/components/Cargas/TempIndicator";

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

function NumeroViaje({ numero }: { numero: number }) {
  return (
    <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md font-semibold">
      #{String(numero).padStart(4, "0")}
    </span>
  );
}

function ResponsableAvatar({ responsable }: { responsable: Viaje["responsable"] }) {
  if (!responsable) return <span className="text-brand-300 text-xs">—</span>;
  const name = (responsable.nombre ?? responsable.email ?? "").trim();
  const parts = name.split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <span
      title={responsable.nombre ?? responsable.email ?? ""}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-900 text-white text-[11px] font-bold shrink-0 select-none"
    >
      {initials || "?"}
    </span>
  );
}

function TermografoModal({
  viajeId,
  onClose,
  onAssigned,
}: {
  viajeId: string;
  onClose: () => void;
  onAssigned: (viajeId: string, termografoId: string) => void;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function connect() {
    const id = input.trim();
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/viajes/${viajeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termografo_id: id }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Termógrafo conectado");
      onAssigned(viajeId, id);
      onClose();
    } else {
      const json = await res.json();
      toast.error(json.error || "Error al conectar");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display font-extrabold text-lg text-brand-900 mb-1">
          Conectar termógrafo
        </div>
        <p className="text-sm text-brand-500 mb-4">
          Ingresa el ID del dispositivo Copeland a asignar a este viaje.
        </p>
        <input
          autoFocus
          type="text"
          placeholder="CPL-001"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-mono text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-brand-300 transition mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={connect}
            disabled={saving || !input.trim()}
            className="flex-1 rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? "Conectando…" : "Conectar"}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ViajeTable({ viajes: initialViajes }: { viajes: Viaje[] }) {
  const router = useRouter();
  const [viajes, setViajes] = useState(initialViajes);
  const [modalViajeId, setModalViajeId] = useState<string | null>(null);

  const [fOvRef, setFOvRef] = useState("");
  const [fFlete, setFFlete] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fOrigen, setFOrigen] = useState("");
  const [fCliente, setFCliente] = useState("");

  const fletes = useMemo(() => unique(viajes.map((v) => v.flete_cargo)), [viajes]);
  const origenes = useMemo(() => unique(viajes.map((v) => v.lugar_inicio)), [viajes]);
  const clientesOpts = useMemo(
    () => unique(viajes.flatMap((v) => (v.ordenes_venta ?? []).map((o) => o.cliente))),
    [viajes]
  );

  const anyFilter = fOvRef || fFlete || fFecha || fOrigen || fCliente;

  function clearFilters() {
    setFOvRef("");
    setFFlete("");
    setFFecha("");
    setFOrigen("");
    setFCliente("");
  }

  const filtered = useMemo(() => {
    const ovLower = fOvRef.toLowerCase();
    return viajes.filter((v) => {
      if (fFlete && v.flete_cargo !== fFlete) return false;
      if (fFecha && v.fecha_inicio !== fFecha) return false;
      if (fOrigen && v.lugar_inicio !== fOrigen) return false;
      if (fOvRef) {
        const match = v.ordenes_venta?.some((o) =>
          o.ov_ref?.toLowerCase().includes(ovLower)
        );
        if (!match) return false;
      }
      if (fCliente) {
        const match = v.ordenes_venta?.some((o) => o.cliente === fCliente);
        if (!match) return false;
      }
      return true;
    });
  }, [viajes, fOvRef, fFlete, fFecha, fOrigen, fCliente]);

  const handleTermografoAssigned = useCallback(
    (viajeId: string, termografoId: string) => {
      setViajes((prev) =>
        prev.map((v) => (v.id === viajeId ? { ...v, termografo_id: termografoId } : v))
      );
      router.refresh();
    },
    [router]
  );

  return (
    <>
      {modalViajeId && (
        <TermografoModal
          viajeId={modalViajeId}
          onClose={() => setModalViajeId(null)}
          onAssigned={handleTermografoAssigned}
        />
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Origen"
            value={fOrigen}
            onChange={setFOrigen}
            options={origenes.map((v) => ({ value: v, label: v }))}
          />
          <FilterSelect
            label="Flete"
            value={fFlete}
            onChange={setFFlete}
            options={fletes.map((v) => ({ value: v, label: v }))}
          />
          <FilterSelect
            label="Cliente"
            value={fCliente}
            onChange={setFCliente}
            options={clientesOpts.map((v) => ({ value: v, label: v }))}
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
          {anyFilter && (
            <button
              onClick={clearFilters}
              className="text-xs text-brand-400 hover:text-brand-700 underline underline-offset-2 transition"
            >
              Limpiar
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-200 p-12 text-center bg-white">
            <div className="text-4xl mb-3">🔍</div>
            <div className="font-display font-semibold text-brand-900 text-lg">Sin resultados</div>
            <div className="text-sm text-brand-500 mt-1">
              No hay viajes que coincidan con los filtros aplicados.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-brand-900 text-brand-50 text-xs uppercase tracking-widest">
                    <th className="text-left px-4 py-3 font-medium"># Viaje</th>
                    <th className="text-left px-4 py-3 font-medium">Ruta</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Clientes</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Fechas</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Flete</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Termógrafo</th>
                    <th className="text-left px-4 py-3 font-medium">Temp</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">OVs</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Resp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {filtered.map((v) => {
                    const ovCount = v.ordenes_venta?.length ?? 0;
                    const firstProducto = v.ordenes_venta?.[0]?.producto;
                    const clientes = unique(v.ordenes_venta?.map((o) => o.cliente) ?? []);
                    const clientesLabel =
                      clientes.length === 0
                        ? null
                        : clientes.length <= 2
                        ? clientes.join(", ")
                        : `${clientes.slice(0, 2).join(", ")} +${clientes.length - 2}`;

                    return (
                      <tr
                        key={v.id}
                        onClick={() => router.push(`/viajes/${v.id}`)}
                        className="hover:bg-brand-50/60 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <NumeroViaje numero={v.numero} />
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/viajes/${v.id}`}
                            className="font-semibold text-brand-900 group-hover:text-brand-700 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {v.lugar_inicio}
                            <span className="text-brand-400 mx-1.5">→</span>
                            {v.lugar_fin}
                          </Link>
                          {v.ordenes_venta && v.ordenes_venta.length > 0 && (
                            <div className="sm:hidden text-xs text-brand-400 mt-0.5">
                              {v.ordenes_venta.length} OV{v.ordenes_venta.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-brand-700 max-w-[160px]">
                          {clientesLabel ? (
                            <span className="line-clamp-2">{clientesLabel}</span>
                          ) : (
                            <span className="text-brand-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-brand-600 tabular-nums text-xs">
                          <div>{v.fecha_inicio}</div>
                          <div className="text-brand-400">{v.fecha_fin}</div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-brand-500 text-xs">
                          {v.flete_cargo ?? <span className="text-brand-300">—</span>}
                        </td>
                        <td
                          className="px-4 py-3 hidden lg:table-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {v.termografo_id ? (
                            <span className="font-mono text-xs text-brand-700">
                              {v.termografo_id}
                            </span>
                          ) : (
                            <button
                              onClick={() => setModalViajeId(v.id)}
                              className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-400 transition whitespace-nowrap"
                            >
                              + Agregar termógrafo
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <TempIndicator
                            value={v.temp_actual}
                            min={firstProducto?.temp_min}
                            max={firstProducto?.temp_max}
                          />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                            {ovCount} OV{ovCount !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <ResponsableAvatar responsable={v.responsable} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-brand-50 text-xs text-brand-400 text-right">
              {anyFilter ? (
                <>
                  <span className="text-brand-700 font-medium">{filtered.length}</span> de{" "}
                  {viajes.length} viaje{viajes.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  {viajes.length} viaje{viajes.length !== 1 ? "s" : ""}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
