"use client";

import Link from "next/link";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Viaje, OrdenVenta } from "@/lib/types";
import { STATUS_LABELS, STATUS_CLASSES } from "@/lib/types";
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

function OVsModal({ viaje, onClose }: { viaje: Viaje; onClose: () => void }) {
  const ovs: OrdenVenta[] = viaje.ordenes_venta ?? [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-50">
          <div>
            <div className="font-display font-bold text-brand-900">
              {viaje.lugar_inicio}
              <span className="text-brand-300 mx-2">→</span>
              {viaje.lugar_fin}
            </div>
            <div className="text-xs text-brand-400 mt-0.5 font-mono">
              #{String(viaje.numero).padStart(4, "0")} · {ovs.length} OV{ovs.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-400 hover:text-brand-700 hover:bg-brand-50 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto">
          {ovs.length === 0 ? (
            <p className="text-sm text-brand-400 text-center py-10">Sin órdenes de venta.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-brand-50 text-xs uppercase tracking-widest text-brand-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">OV / REF</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Entrega</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Producto</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {ovs.map((ov) => (
                  <tr key={ov.id} className="hover:bg-brand-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                        {ov.ov_ref}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-900">{ov.cliente}</div>
                      {ov.cedi && <div className="text-xs text-brand-400">{ov.cedi}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-600">
                      <div>{ov.fecha_entrega}</div>
                      <div className="text-brand-400">{ov.lugar_entrega}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-500">
                      {ov.producto?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[ov.status]}`}>
                        {STATUS_LABELS[ov.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function isCompletado(v: Viaje): boolean {
  const ovs = v.ordenes_venta ?? [];
  return ovs.length > 0 && ovs.every((o) => o.status === "ENTREGADO");
}

export function ViajeTable({ viajes: initialViajes }: { viajes: Viaje[] }) {
  const router = useRouter();
  const [viajes, setViajes] = useState(initialViajes);
  const [modalViajeId, setModalViajeId] = useState<string | null>(null);
  const [ovsModalViaje, setOvsModalViaje] = useState<Viaje | null>(null);
  const [tab, setTab] = useState<"activos" | "completados">("activos");

  const [fOvRef, setFOvRef] = useState("");
  const [fFlete, setFFlete] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fOrigen, setFOrigen] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fTermografo, setFTermografo] = useState("");
  const [fResponsable, setFResponsable] = useState("");

  const tabViajes = useMemo(
    () => viajes.filter((v) => tab === "completados" ? isCompletado(v) : !isCompletado(v)),
    [viajes, tab]
  );

  const completadosCount = useMemo(() => viajes.filter(isCompletado).length, [viajes]);
  const activosCount = viajes.length - completadosCount;

  const fletes = useMemo(() => unique(tabViajes.map((v) => v.flete_cargo)), [tabViajes]);
  const origenes = useMemo(() => unique(tabViajes.map((v) => v.lugar_inicio)), [tabViajes]);
  const clientesOpts = useMemo(
    () => unique(tabViajes.flatMap((v) => (v.ordenes_venta ?? []).map((o) => o.cliente))),
    [tabViajes]
  );
  const responsablesOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of tabViajes) {
      if (v.responsable_id && v.responsable) {
        const label = v.responsable.nombre ?? v.responsable.email ?? v.responsable_id;
        map.set(v.responsable_id, label);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [tabViajes]);

  const anyFilter = fOvRef || fFlete || fFecha || fOrigen || fCliente || fTermografo || fResponsable;

  function clearFilters() {
    setFOvRef("");
    setFFlete("");
    setFFecha("");
    setFOrigen("");
    setFCliente("");
    setFTermografo("");
    setFResponsable("");
  }

  const filtered = useMemo(() => {
    const ovLower = fOvRef.toLowerCase();
    return tabViajes.filter((v) => {
      if (fFlete && v.flete_cargo !== fFlete) return false;
      if (fFecha && v.fecha_inicio !== fFecha) return false;
      if (fOrigen && v.lugar_inicio !== fOrigen) return false;
      if (fTermografo && !v.termografo_id?.toLowerCase().includes(fTermografo.toLowerCase())) return false;
      if (fResponsable && v.responsable_id !== fResponsable) return false;
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
  }, [tabViajes, fOvRef, fFlete, fFecha, fOrigen, fCliente, fTermografo, fResponsable]);

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

      {ovsModalViaje && (
        <OVsModal viaje={ovsModalViaje} onClose={() => setOvsModalViaje(null)} />
      )}

      <div className="space-y-3">
        <div className="flex gap-1 border-b border-brand-100">
          <button
            onClick={() => { setTab("activos"); clearFilters(); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
              tab === "activos"
                ? "bg-brand-900 text-white"
                : "text-brand-500 hover:text-brand-800 hover:bg-brand-50"
            }`}
          >
            Activos
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === "activos" ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"}`}>
              {activosCount}
            </span>
          </button>
          <button
            onClick={() => { setTab("completados"); clearFilters(); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
              tab === "completados"
                ? "bg-emerald-600 text-white"
                : "text-brand-500 hover:text-brand-800 hover:bg-brand-50"
            }`}
          >
            Completados
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === "completados" ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"}`}>
              {completadosCount}
            </span>
          </button>
        </div>

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
            type="text"
            value={fTermografo}
            onChange={(e) => setFTermografo(e.target.value)}
            placeholder="Buscar termógrafo…"
            className={`rounded-lg border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition w-40 ${
              fTermografo
                ? "border-brand-400 text-brand-900 font-medium"
                : "border-brand-200 text-brand-400"
            }`}
          />
          <FilterSelect
            label="Responsable de carga"
            value={fResponsable}
            onChange={setFResponsable}
            options={responsablesOpts}
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
            <svg className="w-9 h-9 mx-auto mb-3 text-brand-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p className="text-sm font-semibold text-brand-700">Sin resultados</p>
            <p className="text-sm text-brand-400 mt-1">No hay viajes que coincidan con los filtros aplicados.</p>
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
                        <td
                          className="px-4 py-3 hidden sm:table-cell"
                          onClick={(e) => { e.stopPropagation(); if (ovCount > 0) setOvsModalViaje(v); }}
                        >
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full transition ${ovCount > 0 ? "text-brand-700 bg-brand-50 hover:bg-brand-200 cursor-pointer" : "text-brand-300 bg-brand-50"}`}>
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
                  {tabViajes.length} viaje{tabViajes.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  {tabViajes.length} viaje{tabViajes.length !== 1 ? "s" : ""}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
