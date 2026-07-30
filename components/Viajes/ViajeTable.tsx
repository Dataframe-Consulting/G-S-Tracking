"use client";

import Link from "next/link";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Viaje, OrdenVenta } from "@/lib/types";
import { STATUS_LABELS, STATUS_CLASSES } from "@/lib/types";
import { TempIndicator } from "@/components/Cargas/TempIndicator";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { formatFecha } from "@/lib/fecha";

function unique(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort();
}

// Flete mostrado/filtrado: concesionario del modelo nuevo, con fallback al campo
// legacy flete_cargo. La columna, las opciones del filtro y la comparación deben
// usar SIEMPRE este mismo valor para no desincronizarse.
function fleteDe(v: Viaje): string | null {
  return v.linea?.concesionario?.nombre ?? v.flete_cargo ?? null;
}

// Cita (fecha_entrega) más próxima entre las OVs visibles de un viaje, o null si
// ninguna tiene cita. Sirve para ordenar Activos por lo que se entrega primero.
function minCita(ovs: OrdenVenta[]): string | null {
  const fechas = ovs
    .map((o) => o.fecha_entrega)
    .filter((f): f is string => Boolean(f));
  return fechas.length ? fechas.reduce((a, b) => (a < b ? a : b)) : null;
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
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-3xl max-h-[80vh] flex flex-col"
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
            <>
            {/* Móvil (<sm): tarjetas con toda la info */}
            <div className="sm:hidden divide-y divide-brand-50">
              {ovs.map((ov) => (
                <div key={ov.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                      {ov.ov_ref}
                    </span>
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASSES[ov.status]}`}>
                      {STATUS_LABELS[ov.status]}
                    </span>
                  </div>
                  <div className="font-medium text-brand-900 text-sm">{ov.cliente}</div>
                  <div className="text-xs text-brand-600">
                    <span className="text-brand-400">Entrega: </span>
                    {formatFecha(ov.fecha_entrega) || "—"}
                    {ov.cedi && <span className="text-brand-400"> · {ov.cedi}</span>}
                  </div>
                  <div className="text-xs text-brand-500">
                    <span className="text-brand-400">Producto: </span>
                    {(ov.productos ?? []).length > 0
                      ? (ov.productos ?? [])
                          .map((p) => `${p.producto?.nombre ?? "—"}${p.cajas != null ? ` (${p.cajas} cj)` : ""}`)
                          .join(", ")
                      : "—"}
                  </div>
                </div>
              ))}
            </div>

            {/* sm+: tabla */}
            <table className="hidden sm:table min-w-full text-sm">
              <thead className="sticky top-0 bg-brand-50 text-xs uppercase tracking-widest text-brand-400">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">OV / REF</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Entrega</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Producto</th>
                  <th className="text-left px-4 py-3 font-medium">Estatus</th>
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
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-600">
                      <div>{formatFecha(ov.fecha_entrega) || "—"}</div>
                      {ov.cedi && <div className="text-brand-400">{ov.cedi}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-brand-500">
                      {(ov.productos ?? []).length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {(ov.productos ?? []).map((p) => (
                            <span key={p.id} className="whitespace-nowrap">
                              {p.producto?.nombre ?? "—"}
                              {p.cajas != null && (
                                <span className="text-brand-400"> · {p.cajas} cj</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASSES[ov.status]}`}>
                        {STATUS_LABELS[ov.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DatoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium text-brand-400">{label}</div>
      <div className="text-sm text-brand-900 mt-0.5">
        {value?.trim() ? value : <span className="text-brand-300">—</span>}
      </div>
    </div>
  );
}

function DatosViajeModal({ viaje, onClose }: { viaje: Viaje; onClose: () => void }) {
  const flete = viaje.linea?.concesionario?.nombre ?? viaje.flete_cargo ?? null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-lg overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-50">
          <div>
            <div className="font-display font-bold text-brand-900">Datos del viaje</div>
            <div className="text-xs text-brand-400 mt-0.5 font-mono">
              #{String(viaje.numero).padStart(4, "0")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-400 hover:text-brand-700 hover:bg-brand-50 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <DatoRow label="Flete" value={flete} />
          <DatoRow label="Línea transportista" value={viaje.linea?.nombre} />
          <DatoRow label="Operador" value={viaje.operador} />
          <div className="grid sm:grid-cols-2 gap-4">
            <DatoRow label="Modelo" value={viaje.modelo} />
            <DatoRow label="Año" value={viaje.anio} />
            <DatoRow label="Placas tracto" value={viaje.placas_tracto} />
            <DatoRow label="Placas caja" value={viaje.placas_caja} />
          </div>
          <DatoRow label="Contacto" value={viaje.contacto_unidad} />
        </div>
      </div>
    </div>
  );
}

type TabKey = "activos" | "completados" | "rechazados";
type TabItem = { viaje: Viaje; ovs: OrdenVenta[] };

function esTerminal(status: OrdenVenta["status"]): boolean {
  return status === "ENTREGADO" || status === "RECHAZO_CALIDAD";
}

// Un viaje está concluido cuando tiene ≥1 OV y TODAS son terminal (entregado o rechazo).
function viajeConcluidoLocal(ovs: OrdenVenta[]): boolean {
  return ovs.length > 0 && ovs.every((o) => esTerminal(o.status));
}

// Devuelve el subconjunto de OVs visible en una pestaña, o null si el viaje no
// pertenece a esa pestaña:
//   activos     → viaje NO concluido (≥1 OV en proceso, o sin OVs) → todas sus OVs
//   completados → viaje concluido, sus OVs entregadas (si tiene ≥1)
//   rechazados  → viaje concluido, sus OVs rechazadas (si tiene ≥1)
// Un viaje concluido mixto aparece en ambas (completados y rechazados) con su pedazo.
function ovsForTab(v: Viaje, tab: TabKey): OrdenVenta[] | null {
  const ovs = v.ordenes_venta ?? [];
  if (tab === "activos") {
    return viajeConcluidoLocal(ovs) ? null : ovs;
  }
  if (!viajeConcluidoLocal(ovs)) return null;
  const subset = ovs.filter((o) =>
    tab === "completados" ? o.status === "ENTREGADO" : o.status === "RECHAZO_CALIDAD"
  );
  return subset.length > 0 ? subset : null;
}

export function ViajeTable({ viajes: initialViajes }: { viajes: Viaje[] }) {
  const router = useRouter();
  const [viajes, setViajes] = useState(initialViajes);
  const [modalViajeId, setModalViajeId] = useState<string | null>(null);
  const [ovsModalViaje, setOvsModalViaje] = useState<Viaje | null>(null);
  const [datosViaje, setDatosViaje] = useState<Viaje | null>(null);
  const [tab, setTab] = useState<TabKey>("activos");
  const [downloading, setDownloading] = useState(false);

  async function downloadExcel() {
    if (filtered.length === 0) {
      toast.error("No hay registros para descargar");
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch("/api/viajes/reporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seccion: tab,
          viaje_ids: filtered.map((it) => it.viaje.id),
        }),
      });
      if (!res.ok) { toast.error("Error al generar el reporte"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "viajes.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const [fOvRef, setFOvRef] = useState("");
  const [fFlete, setFFlete] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fOrigen, setFOrigen] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fTermografo, setFTermografo] = useState("");
  const [fResponsable, setFResponsable] = useState("");

  // Items de la pestaña activa: { viaje, ovs visibles }. Un viaje mixto aparece
  // en completados y en rechazados, cada uno con su subconjunto de OVs.
  const tabItems = useMemo<TabItem[]>(() => {
    const out: TabItem[] = [];
    for (const v of viajes) {
      const ovs = ovsForTab(v, tab);
      if (ovs) out.push({ viaje: v, ovs });
    }
    if (tab === "activos") {
      // G&S: primero los viajes CON cita, por cita ascendente (lo que se entrega
      // primero va arriba). Después los que NO tienen cita, por antigüedad: los
      // más viejos arriba y los más nuevos hasta abajo (número ascendente).
      out.sort((a, b) => {
        const ca = minCita(a.ovs);
        const cb = minCita(b.ovs);
        if (ca && cb) return ca.localeCompare(cb);
        if (ca) return -1;
        if (cb) return 1;
        return a.viaje.numero - b.viaje.numero;
      });
    } else if (tab === "completados" || tab === "rechazados") {
      // Ordenar por cuándo concluyó el viaje (lo más reciente arriba). Los que no
      // tienen fecha de conclusión (datos viejos) caen al final, conservando su
      // orden de creación (numero desc, como llegan de la página).
      out.sort((a, b) => {
        const ta = a.viaje.concluido_at ? new Date(a.viaje.concluido_at).getTime() : 0;
        const tb = b.viaje.concluido_at ? new Date(b.viaje.concluido_at).getTime() : 0;
        return tb - ta;
      });
    }
    return out;
  }, [viajes, tab]);

  // Conteos por pestaña (independientes de la activa). Un viaje mixto suma en ambas.
  const counts = useMemo(() => {
    let activos = 0, completados = 0, rechazados = 0;
    for (const v of viajes) {
      if (ovsForTab(v, "activos")) activos++;
      if (ovsForTab(v, "completados")) completados++;
      if (ovsForTab(v, "rechazados")) rechazados++;
    }
    return { activos, completados, rechazados };
  }, [viajes]);

  const fletes = useMemo(() => unique(tabItems.map((it) => fleteDe(it.viaje))), [tabItems]);
  const origenes = useMemo(() => unique(tabItems.map((it) => it.viaje.lugar_inicio)), [tabItems]);
  const clientesOpts = useMemo(
    () => unique(tabItems.flatMap((it) => it.ovs.map((o) => o.cliente))),
    [tabItems]
  );
  const responsablesOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const { viaje: v } of tabItems) {
      if (v.responsable_id && v.responsable) {
        const label = v.responsable.nombre ?? v.responsable.email ?? v.responsable_id;
        map.set(v.responsable_id, label);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [tabItems]);

  const anyFilter = fOvRef || fFlete || fDesde || fHasta || fOrigen || fCliente || fTermografo || fResponsable;

  function clearFilters() {
    setFOvRef("");
    setFFlete("");
    setFDesde("");
    setFHasta("");
    setFOrigen("");
    setFCliente("");
    setFTermografo("");
    setFResponsable("");
  }

  const filtered = useMemo(() => {
    const ovLower = fOvRef.toLowerCase();
    return tabItems.filter(({ viaje: v, ovs }) => {
      if (fFlete && fleteDe(v) !== fFlete) return false;
      // Filtro por fecha de entrega (cita) de las cargas visibles. Con singleTapDay,
      // si solo se eligió "desde" se filtra ese único día (hastaEff = fDesde). Un
      // viaje pasa si alguna de sus cargas visibles tiene cita dentro del rango.
      if (fDesde || fHasta) {
        const hastaEff = fHasta || fDesde;
        const match = ovs.some((o) => {
          const fe = o.fecha_entrega;
          if (!fe) return false;
          if (fDesde && fe < fDesde) return false;
          if (hastaEff && fe > hastaEff) return false;
          return true;
        });
        if (!match) return false;
      }
      if (fOrigen && v.lugar_inicio !== fOrigen) return false;
      if (
        fTermografo &&
        !(v.termografos ?? []).some((t) =>
          t.id.toLowerCase().includes(fTermografo.toLowerCase())
        )
      )
        return false;
      if (fResponsable && v.responsable_id !== fResponsable) return false;
      if (fOvRef) {
        const match = ovs.some((o) => o.ov_ref?.toLowerCase().includes(ovLower));
        if (!match) return false;
      }
      if (fCliente) {
        const match = ovs.some((o) => o.cliente === fCliente);
        if (!match) return false;
      }
      return true;
    });
  }, [tabItems, fOvRef, fFlete, fDesde, fHasta, fOrigen, fCliente, fTermografo, fResponsable]);

  const handleTermografoAssigned = useCallback(
    (_viajeId: string, _termografoId: string) => {
      // El PATCH ya escribió en la tabla `termografos`; refrescamos para que la
      // vista (que ahora lee de ahí) muestre el termógrafo recién asignado.
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

      {datosViaje && (
        <DatosViajeModal viaje={datosViaje} onClose={() => setDatosViaje(null)} />
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
              {counts.activos}
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
              {counts.completados}
            </span>
          </button>
          <button
            onClick={() => { setTab("rechazados"); clearFilters(); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
              tab === "rechazados"
                ? "bg-red-600 text-white"
                : "text-brand-500 hover:text-brand-800 hover:bg-brand-50"
            }`}
          >
            Rechazados
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === "rechazados" ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"}`}>
              {counts.rechazados}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadExcel}
            disabled={downloading}
            className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 hover:border-brand-400 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloading ? "Descargando…" : "Descargar Excel"}
          </button>
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
          <DateRangePicker
            singleTapDay
            desde={fDesde}
            hasta={fHasta}
            onChange={(d, h) => {
              setFDesde(d);
              setFHasta(h);
            }}
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
          <>
          {/* ── Vista móvil: tarjetas apiladas (<md) ── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map(({ viaje: v, ovs }) => {
              const ovCount = ovs.length;
              const clientes = unique(ovs.map((o) => o.cliente));
              const clientesLabel =
                clientes.length === 0
                  ? null
                  : clientes.length <= 2
                  ? clientes.join(", ")
                  : `${clientes.slice(0, 2).join(", ")} +${clientes.length - 2}`;
              const flete = v.linea?.concesionario?.nombre ?? v.flete_cargo ?? null;
              return (
                <div
                  key={v.id}
                  onClick={() => router.push(`/viajes/${v.id}`)}
                  className="rounded-2xl border border-brand-100 bg-white shadow-sm p-4 active:bg-brand-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <NumeroViaje numero={v.numero} />
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(v.termografos ?? []).length > 0 ? (
                        <TempIndicator value={v.temp_carga ?? v.temp_actual} min={v.temp_min} max={v.temp_max} />
                      ) : (
                        <button
                          onClick={() => setModalViajeId(v.id)}
                          className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 transition whitespace-nowrap"
                        >
                          + Termógrafo
                        </button>
                      )}
                      <ResponsableAvatar responsable={v.responsable} />
                    </div>
                  </div>

                  <div className="font-semibold text-brand-900 leading-snug">
                    {v.lugar_inicio}
                    <span className="text-brand-400 mx-1.5">→</span>
                    {v.lugar_fin}
                  </div>
                  {clientesLabel && (
                    <div className="mt-0.5 text-xs text-brand-500 line-clamp-1">{clientesLabel}</div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-brand-400 mb-0.5">Fechas</div>
                      <div className="text-brand-700 tabular-nums">
                        {formatFecha(v.fecha_inicio)} – {formatFecha(v.fecha_fin)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-brand-400 mb-0.5">Ubicación</div>
                      <div className="text-brand-700">{v.ubicacion_estado ?? v.ubicacion_ciudad ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-brand-400 mb-0.5">Flete</div>
                      {flete ? (
                        <span
                          onClick={(e) => { e.stopPropagation(); setDatosViaje(v); }}
                          className="inline-flex text-xs font-medium px-2 py-0.5 rounded-lg text-brand-700 bg-brand-50"
                        >
                          {flete}
                        </span>
                      ) : (
                        <span className="text-brand-300">—</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-brand-400 mb-0.5">OVS/REF</div>
                      {ovCount > 0 ? (
                        <span
                          onClick={(e) => { e.stopPropagation(); setOvsModalViaje({ ...v, ordenes_venta: ovs }); }}
                          className="inline-flex flex-wrap gap-1 text-xs font-medium text-brand-700"
                        >
                          {ovs.map((o) => (
                            <span key={o.id} className="px-2 py-0.5 rounded-lg bg-brand-50">
                              {o.ov_ref || "—"}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-brand-300">0 OVs</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-xs text-brand-400 text-right px-1">
              {anyFilter
                ? `${filtered.length} de ${tabItems.length} viaje${tabItems.length !== 1 ? "s" : ""}`
                : `${tabItems.length} viaje${tabItems.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          {/* ── Vista desktop: tabla (md+) ── */}
          <div className="hidden md:block rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-brand-900 text-brand-50 text-xs uppercase tracking-widest">
                    <th className="text-left px-4 py-3 font-medium"># Viaje</th>
                    <th className="text-left px-4 py-3 font-medium">Ruta</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Clientes</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">CEDIS</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Fechas</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Flete</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Ubicación</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">OVS/REF</th>
                    <th className="text-left px-4 py-3 font-medium">Temp</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Resp.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {filtered.map(({ viaje: v, ovs }) => {
                    const ovCount = ovs.length;
                    const clientes = unique(ovs.map((o) => o.cliente));
                    const cedis = unique(
                      ovs.map((o) => o.cedi).filter(Boolean) as string[]
                    );
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
                            className="flex flex-col leading-tight font-semibold text-brand-900 group-hover:text-brand-700 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>{v.lugar_inicio}</span>
                            <span>
                              <span className="text-brand-400 mr-1">→</span>
                              {v.lugar_fin}
                            </span>
                          </Link>
                          {ovCount > 0 && (
                            <div className="sm:hidden text-xs text-brand-400 mt-0.5">
                              {ovCount} OV{ovCount !== 1 ? "s" : ""}
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
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-brand-700">
                          {cedis.length > 0 ? (
                            <span className="inline-flex flex-col gap-0.5">
                              {cedis.map((c) => (
                                <span key={c}>{c}</span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-brand-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-brand-600 tabular-nums text-xs">
                          <div>{formatFecha(v.fecha_inicio)}</div>
                          <div className="text-brand-400">{formatFecha(v.fecha_fin)}</div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {fleteDe(v) ? (
                            <span
                              onClick={(e) => { e.stopPropagation(); setDatosViaje(v); }}
                              title="Ver datos del viaje"
                              className="inline-flex text-xs font-medium px-2 py-1 rounded-lg transition text-brand-700 bg-brand-50 hover:bg-brand-200 cursor-pointer"
                            >
                              {fleteDe(v)}
                            </span>
                          ) : (
                            <span className="text-brand-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-brand-700">
                          {v.ubicacion_estado ?? v.ubicacion_ciudad ? (
                            <span className="line-clamp-2">
                              {v.ubicacion_estado ?? v.ubicacion_ciudad}
                            </span>
                          ) : (
                            <span className="text-brand-300">—</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 hidden sm:table-cell"
                          onClick={(e) => { e.stopPropagation(); if (ovCount > 0) setOvsModalViaje({ ...v, ordenes_venta: ovs }); }}
                        >
                          {ovCount > 0 ? (
                            <span className="inline-flex flex-col gap-0.5 text-xs font-medium px-2 py-1 rounded-lg transition text-brand-700 bg-brand-50 hover:bg-brand-200 cursor-pointer">
                              {ovs.map((o) => (
                                <span key={o.id}>{o.ov_ref || "—"}</span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-brand-300 bg-brand-50">
                              0 OVs
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(v.termografos ?? []).length > 0 ? (
                            <TempIndicator
                              value={v.temp_carga ?? v.temp_actual}
                              min={v.temp_min}
                              max={v.temp_max}
                            />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setModalViajeId(v.id); }}
                              className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-400 transition whitespace-nowrap"
                            >
                              + Termógrafo
                            </button>
                          )}
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
                  {tabItems.length} viaje{tabItems.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  {tabItems.length} viaje{tabItems.length !== 1 ? "s" : ""}
                </>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </>
  );
}
