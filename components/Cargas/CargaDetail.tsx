"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { AlertaLog, Carga, LecturaTemperatura, Status } from "@/lib/types";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { TempGauge } from "@/components/Temperatura/TempGauge";
import { TempChart } from "@/components/Temperatura/TempChart";
import { AlertaBanner } from "@/components/Alertas/AlertaBanner";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const MapaTracker = dynamic(() => import("@/components/Mapa/MapaTracker"), { ssr: false });

export function CargaDetail({
  carga: initialCarga,
  lecturas: initialLecturas,
  alertas
}: {
  carga: Carga;
  lecturas: LecturaTemperatura[];
  alertas: AlertaLog[];
}) {
  const router = useRouter();
  const [carga, setCarga] = useState(initialCarga);
  const [lecturas, setLecturas] = useState(initialLecturas);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<Status>(initialCarga.status);
  const [termografoInput, setTermografoInput] = useState("");
  const [savingTermografo, setSavingTermografo] = useState(false);
  const [editingTermografo, setEditingTermografo] = useState(false);

  const tempMin = carga.producto ? Number(carga.producto.temp_min) : null;
  const tempMax = carga.producto ? Number(carga.producto.temp_max) : null;

  const position =
    carga.lat != null && carga.lng != null
      ? { lat: Number(carga.lat), lng: Number(carga.lng) }
      : null;

  const path = [...lecturas]
    .filter((l) => l.lat != null && l.lng != null)
    .reverse()
    .map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) }));

  async function doSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/copeland/sync?cargaId=${carga.id}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Sincronización completada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  async function updateStatus(next: Status) {
    setStatus(next);
    const res = await fetch(`/api/cargas/${carga.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next })
    });
    if (res.ok) {
      toast.success("Status actualizado");
      router.refresh();
    } else {
      toast.error("Error al actualizar");
      setStatus(carga.status);
    }
  }

  async function assignTermografo() {
    const id = termografoInput.trim();
    if (!id) return;
    setSavingTermografo(true);
    const res = await fetch(`/api/cargas/${carga.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termografo_id: id })
    });
    setSavingTermografo(false);
    if (res.ok) {
      setCarga((prev) => ({ ...prev, termografo_id: id }));
      setTermografoInput("");
      setEditingTermografo(false);
      toast.success("Termógrafo asignado");
      router.refresh();
    } else {
      const json = await res.json();
      toast.error(json.error || "Error al asignar termógrafo");
    }
  }

  // Auto-refresh every 3 minutes + realtime subscription for this carga
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`carga-${carga.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cargas", filter: `id=eq.${carga.id}` },
        (payload) => setCarga((prev) => ({ ...prev, ...(payload.new as Partial<Carga>) }))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lecturas_temperatura", filter: `carga_id=eq.${carga.id}` },
        (payload) => {
          const row = payload.new as LecturaTemperatura;
          setLecturas((prev) => [row, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      fetch(`/api/copeland/sync?cargaId=${carga.id}`, { method: "POST" })
        .catch(() => void 0)
        .finally(() => router.refresh());
    }, 3 * 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [carga.id, router]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-slate-500">{carga.ov_ref}</div>
          <h1 className="text-2xl font-bold text-slate-900">{carga.cliente}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={status} large />
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value as Status)}
              className="text-sm rounded-md border border-slate-300 px-2 py-1 bg-white"
            >
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={doSync}
          disabled={syncing || !carga.termografo_id}
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </button>
      </div>

      <AlertaBanner
        active={!!carga.alerta_activa}
        tempActual={carga.temp_actual != null ? Number(carga.temp_actual) : null}
        tempMin={tempMin}
        tempMax={tempMax}
      />

      <div className="grid md:grid-cols-2 gap-3">
        <InfoCell label="Fecha carga" value={carga.fecha_carga} />
        <InfoCell label="Fecha entrega" value={carga.fecha_entrega} />
        <InfoCell label="Cita" value={carga.cita ?? "—"} />
        <InfoCell label="Lugar de carga" value={carga.lugar_carga} />
        <InfoCell
          label="Producto (rango)"
          value={
            carga.producto
              ? `${carga.producto.nombre} · ${tempMin}°–${tempMax}°`
              : "—"
          }
        />
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Termógrafo</div>
          {carga.termografo_id && !editingTermografo ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium font-mono text-slate-800">{carga.termografo_id}</span>
              <button
                onClick={() => { setEditingTermografo(true); setTermografoInput(carga.termografo_id ?? ""); }}
                className="text-xs text-brand-700 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : editingTermografo || !carga.termografo_id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ID del termógrafo"
                value={termografoInput}
                onChange={(e) => setTermografoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && assignTermografo()}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={assignTermografo}
                disabled={savingTermografo || !termografoInput.trim()}
                className="rounded-md bg-brand-900 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {savingTermografo ? "..." : "Guardar"}
              </button>
              {editingTermografo && (
                <button
                  onClick={() => setEditingTermografo(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              )}
            </div>
          ) : null}
        </div>
        <InfoCell label="Flete" value={carga.flete_cargo ?? "—"} />
        <InfoCell
          label="Última lectura"
          value={
            carga.ultima_lectura
              ? new Date(carga.ultima_lectura).toLocaleString("es-MX")
              : "—"
          }
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          Descripción del producto
        </div>
        <div className="whitespace-pre-wrap text-sm text-slate-800">
          {carga.producto_descripcion}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden h-96">
          <MapaTracker
            position={position}
            path={path}
            outOfRange={!!carga.alerta_activa}
            title={carga.ov_ref}
          />
        </div>
        <div className="space-y-3">
          {tempMin != null && tempMax != null ? (
            <>
              <TempGauge
                value={carga.temp_actual != null ? Number(carga.temp_actual) : null}
                min={tempMin}
                max={tempMax}
              />
              <TempChart lecturas={lecturas} min={tempMin} max={tempMax} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 bg-white">
              Asigna un producto para habilitar el monitoreo por rango de temperatura.
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium">
            Últimas lecturas
          </div>
          {lecturas.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Sin lecturas aún.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Hora</th>
                  <th className="text-left px-3 py-2">Temp</th>
                  <th className="text-left px-3 py-2">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {lecturas.slice(0, 10).map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">
                      {new Date(l.timestamp).toLocaleTimeString("es-MX")}
                    </td>
                    <td className={`px-3 py-1.5 font-semibold ${l.fuera_rango ? "text-red-600" : "text-slate-800"}`}>
                      {Number(l.temperatura).toFixed(1)}°C
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-500">
                      {l.lat != null && l.lng != null
                        ? `${Number(l.lat).toFixed(3)}, ${Number(l.lng).toFixed(3)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium">
            Alertas enviadas
          </div>
          {alertas.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">Sin alertas.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alertas.map((a) => (
                <li key={a.id} className="px-4 py-2 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {a.tipo === "TEMP_ALTA" ? "🔴 Temp ALTA" : "🔵 Temp BAJA"}
                      {a.temperatura != null && (
                        <span className="ml-2 text-slate-600">
                          {Number(a.temperatura).toFixed(1)}°C
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(a.created_at).toLocaleString("es-MX")} · {a.enviado_a}
                    </div>
                  </div>
                  {a.whatsapp_sid ? (
                    <span className="text-xs text-emerald-600">Enviado</span>
                  ) : (
                    <span className="text-xs text-amber-600">Sin envío</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}
