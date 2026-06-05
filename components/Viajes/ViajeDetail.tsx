"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type {
  AlertaLog,
  Auditoria,
  Concesionario,
  LecturaTemperatura,
  OrdenVenta,
  Producto,
  ProductoCombinacion,
  Responsable,
  Status,
  Termografo,
  Transportista,
  Viaje,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";
import { StatusBadge } from "@/components/Cargas/StatusBadge";
import { TempGauge } from "@/components/Temperatura/TempGauge";
import { TempChart } from "@/components/Temperatura/TempChart";
import { AlertaBanner } from "@/components/Alertas/AlertaBanner";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CiudadCombobox } from "@/components/ui/CiudadCombobox";
import { ModificacionesSection } from "@/components/Viajes/ModificacionesSection";
import { cToF } from "@/lib/temperature";
import { to12h } from "@/lib/time";

const MapaTracker = dynamic(() => import("@/components/Mapa/MapaTracker"), { ssr: false });

const _geoCache = new Map<string, string>();

function GeoCell({ lat, lng }: { lat: number; lng: number }) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const [label, setLabel] = useState<string | null>(_geoCache.get(key) ?? null);
  const fetched = useRef(_geoCache.has(key));

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { "Accept-Language": "es-MX,es" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const parts = (data.display_name ?? "")
          .split(", ")
          .filter((p: string) => !/^\d{4,5}$/.test(p) && p !== "México" && p !== "Mexico");
        const result = parts.slice(0, 4).join(", ") || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        _geoCache.set(key, result);
        setLabel(result);
      })
      .catch(() => setLabel(`${lat.toFixed(3)}, ${lng.toFixed(3)}`));
  }, [key, lat, lng]);

  if (!label) return <span className="text-brand-300 text-xs">…</span>;
  return <span>{label}</span>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-semibold text-brand-600 shrink-0">{children}</h2>
      <div className="flex-1 h-px bg-brand-100" />
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
      <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">{label}</div>
      <div className="text-sm font-medium text-brand-900">{value || "—"}</div>
    </div>
  );
}

function EditCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-300 bg-white px-4 py-3 ring-1 ring-brand-100">
      <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">{label}</div>
      {children}
    </div>
  );
}

function ResponsableAvatar({ responsable }: { responsable: Responsable | null | undefined }) {
  if (!responsable) return null;
  const name = (responsable.nombre ?? responsable.email ?? "").trim();
  const parts = name.split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-900 text-white text-xs font-bold shrink-0 select-none">
      {initials || "?"}
    </span>
  );
}

const bareInput =
  "w-full text-sm font-medium text-brand-900 bg-transparent focus:outline-none placeholder:text-brand-300";
const bareSelect =
  "w-full text-sm font-medium text-brand-900 bg-transparent focus:outline-none cursor-pointer";
const fieldCls =
  "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-brand-300 transition";

function parseProductoSel(sel: string): {
  producto_id: string | null;
  producto_combinacion_id: string | null;
} {
  if (sel.startsWith("prod:")) return { producto_id: sel.slice(5), producto_combinacion_id: null };
  if (sel.startsWith("combo:"))
    return { producto_id: null, producto_combinacion_id: sel.slice(6) };
  return { producto_id: null, producto_combinacion_id: null };
}

function productoSelFromOV(ov: OrdenVenta): string {
  if (ov.producto_id) return `prod:${ov.producto_id}`;
  if (ov.producto_combinacion_id) return `combo:${ov.producto_combinacion_id}`;
  return "";
}

type OVFormData = {
  ov_ref: string;
  cliente: string;
  cedi: string;
  fecha_carga: string;
  lugar_carga: string;
  fecha_entrega: string;
  cita: string;
  tiene_cita: boolean;
  po: string;
  folio_cita: string;
  factura_gys: string;
  status: Status;
  instrucciones: string;
  producto_sel: string;
  cajas: string;
  cajas_b: string;
};

type ClienteConCedis = { id: string; nombre: string; cedis?: { id: string; nombre: string }[] };

const emptyOVForm = (today: string): OVFormData => ({
  ov_ref: "",
  cliente: "",
  cedi: "",
  fecha_carga: today,
  lugar_carga: "",
  fecha_entrega: today,
  cita: "",
  tiene_cita: false,
  po: "",
  folio_cita: "",
  factura_gys: "",
  status: "PENDIENTE",
  instrucciones: "",
  producto_sel: "",
  cajas: "",
  cajas_b: "",
});

function OVFormPanel({
  viaje_id,
  editingOV,
  productos,
  combinaciones,
  clientes,
  lugaresCarga,
  onSaved,
  onCancel,
}: {
  viaje_id: string;
  editingOV: OrdenVenta | null;
  productos: Producto[];
  combinaciones: ProductoCombinacion[];
  clientes: ClienteConCedis[];
  lugaresCarga: { id: string; nombre: string }[];
  onSaved: (ov: OrdenVenta) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<OVFormData>(() =>
    editingOV
      ? {
          ov_ref: editingOV.ov_ref,
          cliente: editingOV.cliente,
          cedi: editingOV.cedi ?? "",
          fecha_carga: editingOV.fecha_carga,
          lugar_carga: editingOV.lugar_carga,
          fecha_entrega: editingOV.fecha_entrega ?? "",
          cita: editingOV.cita ?? "",
          tiene_cita: editingOV.tiene_cita ?? false,
          po: editingOV.po ?? "",
          folio_cita: editingOV.folio_cita ?? "",
          factura_gys: editingOV.factura_gys ?? "",
          status: editingOV.status,
          instrucciones: editingOV.instrucciones,
          producto_sel: productoSelFromOV(editingOV),
          cajas: editingOV.cajas != null ? String(editingOV.cajas) : "",
          cajas_b: editingOV.cajas_b != null ? String(editingOV.cajas_b) : "",
        }
      : emptyOVForm(today)
  );
  const [saving, setSaving] = useState(false);
  const [lugarLibre, setLugarLibre] = useState<boolean>(() => {
    if (!editingOV || lugaresCarga.length === 0) return false;
    return !lugaresCarga.some((l) => l.nombre === editingOV.lugar_carga);
  });

  function upd<K extends keyof OVFormData>(key: K, val: OVFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const isCombo = form.producto_sel.startsWith("combo:");
  const isProd = form.producto_sel.startsWith("prod:");
  const selectedCombo = isCombo
    ? combinaciones.find((c) => c.id === form.producto_sel.slice(6))
    : null;
  const clienteCedis =
    clientes.find((c) => c.nombre === form.cliente)?.cedis ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.producto_sel) {
      toast.error("Selecciona un producto");
      return;
    }
    if (clienteCedis.length > 0 && !form.cedi) {
      toast.error("Selecciona un CEDIS");
      return;
    }
    setSaving(true);
    const { producto_id, producto_combinacion_id } = parseProductoSel(form.producto_sel);
    const body = {
      ov_ref: form.ov_ref,
      cliente: form.cliente,
      cedi: form.cedi || null,
      fecha_carga: form.fecha_carga,
      lugar_carga: form.lugar_carga,
      fecha_entrega: form.tiene_cita ? form.fecha_entrega || null : null,
      cita: form.tiene_cita ? form.cita || null : null,
      tiene_cita: form.tiene_cita,
      po: form.tiene_cita ? form.po || null : null,
      folio_cita: form.tiene_cita ? form.folio_cita || null : null,
      factura_gys: form.tiene_cita ? form.factura_gys || null : null,
      status: form.status,
      instrucciones: form.instrucciones,
      producto_id,
      producto_combinacion_id,
      cajas: form.cajas !== "" ? Number(form.cajas) : null,
      cajas_b: form.cajas_b !== "" ? Number(form.cajas_b) : null,
    };

    const url = editingOV
      ? `/api/viajes/${viaje_id}/ordenes/${editingOV.id}`
      : `/api/viajes/${viaje_id}/ordenes`;
    const method = editingOV ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error al guardar");
      return;
    }
    toast.success(editingOV ? "OV actualizada" : "OV agregada");
    onSaved(json.data as OrdenVenta);
  }

  return (
    <form
      onSubmit={submit}
      className="bg-brand-50 rounded-2xl border border-brand-200 p-5 space-y-4"
    >
      <div className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
        {editingOV ? "Editar Carga" : "Nueva Carga"}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="block text-xs font-medium text-brand-700">
          OV / REF
          <input
            type="text"
            value={form.ov_ref}
            onChange={(e) => upd("ov_ref", e.target.value)}
            className={`${fieldCls} font-mono mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-brand-700">
          Cliente *
          <select
            required
            value={form.cliente}
            onChange={(e) => {
              upd("cliente", e.target.value);
              upd("cedi", "");
            }}
            className={`${fieldCls} bg-white mt-1`}
          >
            <option value="">— Selecciona cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        {clienteCedis.length > 0 && (
          <label className="block text-xs font-medium text-brand-700">
            CEDIS *
            <select
              required
              value={form.cedi}
              onChange={(e) => upd("cedi", e.target.value)}
              className={`${fieldCls} bg-white mt-1`}
            >
              <option value="">— Selecciona CEDIS —</option>
              {clienteCedis.map((d) => (
                <option key={d.id} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs font-medium text-brand-700">
          Estatus
          <select
            value={form.status}
            onChange={(e) => upd("status", e.target.value as Status)}
            className={`${fieldCls} bg-white mt-1`}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-brand-700">
          Fecha de carga *
          <input
            type="date"
            required
            value={form.fecha_carga}
            onChange={(e) => upd("fecha_carga", e.target.value)}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <div className="block text-xs font-medium text-brand-700">
          Lugar de carga *
          {lugaresCarga.length > 0 ? (
            <div className="mt-1 space-y-1.5">
              <select
                required={!lugarLibre}
                value={lugarLibre ? "__otro__" : form.lugar_carga}
                onChange={(e) => {
                  if (e.target.value === "__otro__") {
                    setLugarLibre(true);
                    upd("lugar_carga", "");
                  } else {
                    setLugarLibre(false);
                    upd("lugar_carga", e.target.value);
                  }
                }}
                className={`${fieldCls} bg-white`}
              >
                <option value="">— Selecciona lugar —</option>
                {lugaresCarga.map((l) => (
                  <option key={l.id} value={l.nombre}>
                    {l.nombre}
                  </option>
                ))}
                <option value="__otro__">Otro (texto libre)…</option>
              </select>
              {lugarLibre && (
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Escribe el lugar de carga"
                  value={form.lugar_carga}
                  onChange={(e) => upd("lugar_carga", e.target.value)}
                  className={fieldCls}
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              required
              placeholder="Hermosillo"
              value={form.lugar_carga}
              onChange={(e) => upd("lugar_carga", e.target.value)}
              className={`${fieldCls} mt-1`}
            />
          )}
        </div>
        <label className="block text-xs font-medium text-brand-700">
          Producto *
          <select
            value={form.producto_sel}
            onChange={(e) => upd("producto_sel", e.target.value)}
            className={`${fieldCls} bg-white mt-1`}
          >
            <option value="">— Selecciona producto —</option>
            {productos.length > 0 && (
              <optgroup label="── Individuales">
                {productos.map((p) => (
                  <option key={p.id} value={`prod:${p.id}`}>
                    {p.nombre} ({(cToF(p.temp_min) as number).toFixed(0)}° — {(cToF(p.temp_max) as number).toFixed(0)}°F)
                  </option>
                ))}
              </optgroup>
            )}
            {combinaciones.length > 0 && (
              <optgroup label="── Combinados">
                {combinaciones.map((c) => (
                  <option key={c.id} value={`combo:${c.id}`}>
                    {c.producto_a.nombre} + {c.producto_b.nombre} ({(cToF(c.temp_min) as number).toFixed(0)}° — {(cToF(c.temp_max) as number).toFixed(0)}°F)
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {isProd && (
          <label className="block text-xs font-medium text-brand-700">
            Cajas
            <input
              type="number"
              min={0}
              value={form.cajas}
              onChange={(e) => upd("cajas", e.target.value)}
              placeholder="0"
              className={`${fieldCls} mt-1`}
            />
          </label>
        )}

        {isCombo && (
          <>
            <label className="block text-xs font-medium text-brand-700">
              Cajas {selectedCombo?.producto_a.nombre ?? "Producto A"}
              <input
                type="number"
                min={0}
                value={form.cajas}
                onChange={(e) => upd("cajas", e.target.value)}
                placeholder="0"
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Cajas {selectedCombo?.producto_b.nombre ?? "Producto B"}
              <input
                type="number"
                min={0}
                value={form.cajas_b}
                onChange={(e) => upd("cajas_b", e.target.value)}
                placeholder="0"
                className={`${fieldCls} mt-1`}
              />
            </label>
          </>
        )}

        <label className="block text-xs font-medium text-brand-700 lg:col-span-3">
          Instrucciones
          <textarea
            rows={2}
            value={form.instrucciones}
            onChange={(e) => upd("instrucciones", e.target.value)}
            className={`${fieldCls} mt-1 resize-none`}
          />
        </label>
      </div>

      {/* ¿Existe cita? */}
      <div className="rounded-2xl border border-brand-200 bg-white/60 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-brand-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.tiene_cita}
            onChange={(e) => upd("tiene_cita", e.target.checked)}
            className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
          />
          ¿Existe cita?
        </label>
        {form.tiene_cita && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-brand-700">
              PO
              <input
                type="text"
                value={form.po}
                onChange={(e) => upd("po", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Folio de cita
              <input
                type="text"
                value={form.folio_cita}
                onChange={(e) => upd("folio_cita", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Fecha de la cita
              <input
                type="date"
                value={form.fecha_entrega}
                onChange={(e) => upd("fecha_entrega", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Hora de la cita
              <input
                type="time"
                value={form.cita}
                onChange={(e) => upd("cita", e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Factura
              <input
                type="text"
                value={form.factura_gys}
                onChange={(e) => upd("factura_gys", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
        >
          {saving ? "Guardando…" : editingOV ? "Guardar cambios" : "Agregar Carga"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-white transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function OVDetailModal({
  ov: initialOv,
  viaje_id,
  productos,
  combinaciones,
  clientes,
  initialEditing = false,
  onClose,
  onSaved,
  onDelete,
}: {
  ov: OrdenVenta;
  viaje_id: string;
  productos: Producto[];
  combinaciones: ProductoCombinacion[];
  clientes: ClienteConCedis[];
  initialEditing?: boolean;
  onClose: () => void;
  onSaved: (ov: OrdenVenta) => void;
  onDelete: (ov: OrdenVenta) => void;
}) {
  const [ov, setOv] = useState(initialOv);
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [form, setForm] = useState<OVFormData>(() => ({
    ov_ref: initialOv.ov_ref,
    cliente: initialOv.cliente,
    cedi: initialOv.cedi ?? "",
    fecha_carga: initialOv.fecha_carga,
    lugar_carga: initialOv.lugar_carga,
    fecha_entrega: initialOv.fecha_entrega ?? "",
    cita: initialOv.cita ?? "",
    tiene_cita: initialOv.tiene_cita ?? false,
    po: initialOv.po ?? "",
    folio_cita: initialOv.folio_cita ?? "",
    factura_gys: initialOv.factura_gys ?? "",
    status: initialOv.status,
    instrucciones: initialOv.instrucciones,
    producto_sel: productoSelFromOV(initialOv),
    cajas: initialOv.cajas != null ? String(initialOv.cajas) : "",
    cajas_b: initialOv.cajas_b != null ? String(initialOv.cajas_b) : "",
  }));
  const [saving, setSaving] = useState(false);

  function upd<K extends keyof OVFormData>(key: K, val: OVFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function startEdit() {
    setForm({
      ov_ref: ov.ov_ref,
      cliente: ov.cliente,
      cedi: ov.cedi ?? "",
      fecha_carga: ov.fecha_carga,
      lugar_carga: ov.lugar_carga,
      fecha_entrega: ov.fecha_entrega ?? "",
      cita: ov.cita ?? "",
      tiene_cita: ov.tiene_cita ?? false,
      po: ov.po ?? "",
      folio_cita: ov.folio_cita ?? "",
      factura_gys: ov.factura_gys ?? "",
      status: ov.status,
      instrucciones: ov.instrucciones,
      producto_sel: productoSelFromOV(ov),
      cajas: ov.cajas != null ? String(ov.cajas) : "",
      cajas_b: ov.cajas_b != null ? String(ov.cajas_b) : "",
    });
    setIsEditing(true);
  }

  const modalClienteCedis =
    clientes.find((c) => c.nombre === form.cliente)?.cedis ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.producto_sel) { toast.error("Selecciona un producto"); return; }
    if (modalClienteCedis.length > 0 && !form.cedi) {
      toast.error("Selecciona un CEDIS");
      return;
    }
    setSaving(true);
    const { producto_id, producto_combinacion_id } = parseProductoSel(form.producto_sel);
    const body = {
      ov_ref: form.ov_ref,
      cliente: form.cliente,
      cedi: form.cedi || null,
      fecha_carga: form.fecha_carga,
      lugar_carga: form.lugar_carga,
      fecha_entrega: form.tiene_cita ? form.fecha_entrega || null : null,
      cita: form.tiene_cita ? form.cita || null : null,
      tiene_cita: form.tiene_cita,
      po: form.tiene_cita ? form.po || null : null,
      folio_cita: form.tiene_cita ? form.folio_cita || null : null,
      factura_gys: form.tiene_cita ? form.factura_gys || null : null,
      status: form.status,
      instrucciones: form.instrucciones,
      producto_id,
      producto_combinacion_id,
      cajas: form.cajas !== "" ? Number(form.cajas) : null,
      cajas_b: form.cajas_b !== "" ? Number(form.cajas_b) : null,
    };
    const res = await fetch(`/api/viajes/${viaje_id}/ordenes/${ov.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    const updated = json.data as OrdenVenta;
    setOv(updated);
    setIsEditing(false);
    toast.success("OV actualizada");
    onSaved(updated);
  }

  const combo =
    ov.combo ??
    (ov.producto_combinacion_id
      ? combinaciones.find((c) => c.id === ov.producto_combinacion_id)
      : null);
  const isCombo = form.producto_sel.startsWith("combo:");
  const isProd = form.producto_sel.startsWith("prod:");
  const selectedCombo = isCombo
    ? combinaciones.find((c) => c.id === form.producto_sel.slice(6))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-xl overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditing ? (
          /* ── EDIT MODE ── */
          <form onSubmit={save}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-50">
              <div className="font-display font-bold text-brand-900">
                Editar Carga
                <span className="ml-2 font-mono text-brand-400 font-normal text-sm">{ov.ov_ref}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-brand-400 hover:text-brand-700 transition"
              >
                Cancelar
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* OV/REF + Status */}
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-brand-700">
                  OV / REF
                  <input
                    type="text"
                    value={form.ov_ref}
                    onChange={(e) => upd("ov_ref", e.target.value)}
                    className={`${fieldCls} font-mono mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-brand-700">
                  Estatus
                  <select
                    value={form.status}
                    onChange={(e) => upd("status", e.target.value as Status)}
                    className={`${fieldCls} bg-white mt-1`}
                  >
                    {STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Cliente + Cedi */}
              <div className={`grid gap-3 ${modalClienteCedis.length > 0 ? "sm:grid-cols-2" : ""}`}>
                <label className="block text-xs font-medium text-brand-700">
                  Cliente *
                  <select
                    required
                    value={form.cliente}
                    onChange={(e) => { upd("cliente", e.target.value); upd("cedi", ""); }}
                    className={`${fieldCls} bg-white mt-1`}
                  >
                    <option value="">— Selecciona cliente —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </label>
                {modalClienteCedis.length > 0 && (
                  <label className="block text-xs font-medium text-brand-700">
                    CEDIS *
                    <select
                      required
                      value={form.cedi}
                      onChange={(e) => upd("cedi", e.target.value)}
                      className={`${fieldCls} bg-white mt-1`}
                    >
                      <option value="">— Selecciona CEDIS —</option>
                      {modalClienteCedis.map((d) => (
                        <option key={d.id} value={d.nombre}>{d.nombre}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Carga */}
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block text-xs font-medium text-brand-700">
                  Fecha carga *
                  <input
                    type="date"
                    required
                    value={form.fecha_carga}
                    onChange={(e) => upd("fecha_carga", e.target.value)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-brand-700 sm:col-span-2">
                  Lugar de carga *
                  <input
                    type="text"
                    required
                    placeholder="Hermosillo"
                    value={form.lugar_carga}
                    onChange={(e) => upd("lugar_carga", e.target.value)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
              </div>

              {/* Producto + Cajas */}
              <div className={`grid gap-3 ${isProd ? "sm:grid-cols-2" : isCombo ? "sm:grid-cols-3" : ""}`}>
                <label className="block text-xs font-medium text-brand-700">
                  Producto *
                  <select
                    value={form.producto_sel}
                    onChange={(e) => upd("producto_sel", e.target.value)}
                    className={`${fieldCls} bg-white mt-1`}
                  >
                    <option value="">— Selecciona producto —</option>
                    {productos.length > 0 && (
                      <optgroup label="── Individuales">
                        {productos.map((p) => (
                          <option key={p.id} value={`prod:${p.id}`}>
                            {p.nombre} ({(cToF(p.temp_min) as number).toFixed(0)}° — {(cToF(p.temp_max) as number).toFixed(0)}°F)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {combinaciones.length > 0 && (
                      <optgroup label="── Combinados">
                        {combinaciones.map((c) => (
                          <option key={c.id} value={`combo:${c.id}`}>
                            {c.producto_a.nombre} + {c.producto_b.nombre} ({(cToF(c.temp_min) as number).toFixed(0)}° — {(cToF(c.temp_max) as number).toFixed(0)}°F)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {isProd && (
                  <label className="block text-xs font-medium text-brand-700">
                    Cajas
                    <input
                      type="number"
                      min={0}
                      value={form.cajas}
                      onChange={(e) => upd("cajas", e.target.value)}
                      placeholder="0"
                      className={`${fieldCls} mt-1`}
                    />
                  </label>
                )}
                {isCombo && (
                  <>
                    <label className="block text-xs font-medium text-brand-700">
                      Cajas {selectedCombo?.producto_a.nombre ?? "Producto A"}
                      <input
                        type="number"
                        min={0}
                        value={form.cajas}
                        onChange={(e) => upd("cajas", e.target.value)}
                        placeholder="0"
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-700">
                      Cajas {selectedCombo?.producto_b.nombre ?? "Producto B"}
                      <input
                        type="number"
                        min={0}
                        value={form.cajas_b}
                        onChange={(e) => upd("cajas_b", e.target.value)}
                        placeholder="0"
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Instrucciones */}
              <label className="block text-xs font-medium text-brand-700">
                Instrucciones
                <textarea
                  rows={3}
                  value={form.instrucciones}
                  onChange={(e) => upd("instrucciones", e.target.value)}
                  className={`${fieldCls} mt-1 resize-none`}
                />
              </label>

              {/* ¿Existe cita? */}
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-brand-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.tiene_cita}
                    onChange={(e) => upd("tiene_cita", e.target.checked)}
                    className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                  />
                  ¿Existe cita?
                </label>
                {form.tiene_cita && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-brand-700">
                      PO
                      <input
                        type="text"
                        value={form.po}
                        onChange={(e) => upd("po", e.target.value)}
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-700">
                      Folio de cita
                      <input
                        type="text"
                        value={form.folio_cita}
                        onChange={(e) => upd("folio_cita", e.target.value)}
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-700">
                      Fecha de la cita
                      <input
                        type="date"
                        value={form.fecha_entrega}
                        onChange={(e) => upd("fecha_entrega", e.target.value)}
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-700">
                      Hora de la cita
                      <input
                        type="time"
                        value={form.cita}
                        onChange={(e) => upd("cita", e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                    <label className="block text-xs font-medium text-brand-700">
                      Factura
                      <input
                        type="text"
                        value={form.factura_gys}
                        onChange={(e) => upd("factura_gys", e.target.value)}
                        className={`${fieldCls} mt-1`}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          /* ── VIEW MODE ── */
          <>
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-brand-50">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-0.5">
                  OV / REF
                </div>
                <div className="font-display font-extrabold text-2xl text-brand-900 font-mono tracking-tight">
                  {ov.ov_ref}
                </div>
              </div>
              <StatusBadge status={ov.status} />
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Cliente */}
              <div>
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">Cliente</div>
                <div className="text-sm font-semibold text-brand-900">{ov.cliente}</div>
                {ov.cedi && <div className="text-xs text-brand-500 mt-0.5">CEDIS: {ov.cedi}</div>}
              </div>

              {/* Carga / Cita */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Carga</div>
                  <div className="text-sm font-medium text-brand-900">{ov.fecha_carga}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{ov.lugar_carga}</div>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Cita</div>
                  {ov.tiene_cita ? (
                    <div className="space-y-0.5">
                      {ov.fecha_entrega && (
                        <div className="text-sm font-medium text-brand-900">
                          {ov.fecha_entrega}{ov.cita ? ` · ${to12h(ov.cita)}` : ""}
                        </div>
                      )}
                      {ov.po && <div className="text-xs text-brand-500">PO: {ov.po}</div>}
                      {ov.folio_cita && <div className="text-xs text-brand-500">Folio: {ov.folio_cita}</div>}
                      {ov.factura_gys && <div className="text-xs text-brand-500">Factura GyS: {ov.factura_gys}</div>}
                    </div>
                  ) : (
                    <div className="text-sm text-brand-400">Sin cita</div>
                  )}
                </div>
              </div>

              {/* Producto */}
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Producto</div>
                {ov.producto ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-brand-900">{ov.producto.nombre}</div>
                      <div className="text-xs text-brand-500">{(cToF(ov.producto.temp_min) as number).toFixed(0)}° — {(cToF(ov.producto.temp_max) as number).toFixed(0)}°F</div>
                    </div>
                    {ov.cajas != null && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-brand-900">{ov.cajas}</div>
                        <div className="text-xs text-brand-400">cajas</div>
                      </div>
                    )}
                  </div>
                ) : combo ? (
                  <div>
                    <div className="text-xs text-brand-500 mb-2">{(cToF(combo.temp_min) as number).toFixed(0)}° — {(cToF(combo.temp_max) as number).toFixed(0)}°F</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between rounded-lg bg-white border border-brand-100 px-3 py-2">
                        <div className="text-sm font-medium text-brand-900 truncate">{combo.producto_a.nombre}</div>
                        {ov.cajas != null && <div className="text-sm font-bold text-brand-700 ml-2 shrink-0">{ov.cajas} cj</div>}
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white border border-brand-100 px-3 py-2">
                        <div className="text-sm font-medium text-brand-900 truncate">{combo.producto_b.nombre}</div>
                        {ov.cajas_b != null && <div className="text-sm font-bold text-brand-700 ml-2 shrink-0">{ov.cajas_b} cj</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-brand-400">—</div>
                )}
              </div>

              {/* Instrucciones */}
              <div>
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">Instrucciones</div>
                {ov.instrucciones && ov.instrucciones.trim() ? (
                  <p className="text-sm text-brand-700 whitespace-pre-wrap leading-relaxed">{ov.instrucciones}</p>
                ) : (
                  <p className="text-sm text-brand-400">—</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
              <button
                onClick={startEdit}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 transition shadow-sm"
              >
                Editar
              </button>
              <button
                onClick={() => onDelete(ov)}
                className="rounded-xl border border-red-200 px-5 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition"
              >
                Eliminar
              </button>
              <button
                onClick={onClose}
                className="ml-auto rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TermografoModalContent({
  viajeId,
  onClose,
  onAdded,
}: {
  viajeId: string;
  onClose: () => void;
  onAdded: (termografos: Termografo[]) => void;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function connect() {
    const id = input.trim();
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/viajes/${viajeId}/termografos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termografo_id: id }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      toast.success("Termógrafo conectado");
      onAdded(json.termografos ?? []);
    } else {
      const json = await res.json();
      toast.error(json.error || "Error al conectar");
    }
  }

  return (
    <>
      <div className="font-display font-extrabold text-lg text-brand-900 mb-1">
        Agregar termógrafo
      </div>
      <p className="text-sm text-brand-500 mb-4">
        Ingresa el número de serie del dispositivo Copeland (impreso en el termógrafo físico).
      </p>
      <input
        autoFocus
        type="text"
        placeholder="Ej: 1901088888"
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
    </>
  );
}

function DatosViajeModal({
  viaje,
  concesionarios,
  onClose,
  onSaved,
}: {
  viaje: Viaje;
  concesionarios: Concesionario[];
  onClose: () => void;
  onSaved: (v: Viaje) => void;
}) {
  const [form, setForm] = useState({
    linea_transportista_id: viaje.linea_transportista_id ?? "",
    operador: viaje.operador ?? "",
    modelo: viaje.modelo ?? "",
    anio: viaje.anio ?? "",
    placas_tracto: viaje.placas_tracto ?? "",
    placas_caja: viaje.placas_caja ?? "",
    contacto_unidad: viaje.contacto_unidad ?? "",
  });
  const [saving, setSaving] = useState(false);

  function upd<K extends keyof typeof form>(k: K, val: string) {
    setForm((f) => ({ ...f, [k]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      linea_transportista_id: form.linea_transportista_id || null,
      operador: form.operador.trim() || null,
      modelo: form.modelo.trim() || null,
      anio: form.anio.trim() || null,
      placas_tracto: form.placas_tracto.trim() || null,
      placas_caja: form.placas_caja.trim() || null,
      contacto_unidad: form.contacto_unidad.trim() || null,
    };
    const res = await fetch(`/api/viajes/${viaje.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error al guardar");
      return;
    }
    const sel = concesionarios
      .flatMap((c) => (c.lineas_transportista ?? []).map((l) => ({ l, c })))
      .find((x) => x.l.id === form.linea_transportista_id);
    const linea = sel
      ? { id: sel.l.id, nombre: sel.l.nombre, concesionario: { id: sel.c.id, nombre: sel.c.nombre } }
      : null;
    onSaved({ ...viaje, ...body, linea } as Viaje);
    toast.success("Datos del viaje guardados");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-lg overflow-y-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-50">
          <div className="font-display font-bold text-brand-900">Datos del viaje</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-brand-400 hover:text-brand-700 transition"
          >
            Cancelar
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block text-xs font-medium text-brand-700">
            Línea transportista
            <select
              value={form.linea_transportista_id}
              onChange={(e) => upd("linea_transportista_id", e.target.value)}
              className={`${fieldCls} bg-white mt-1`}
            >
              <option value="">— Sin línea —</option>
              {concesionarios.map((c) => (
                <optgroup key={c.id} label={c.nombre}>
                  {(c.lineas_transportista ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-brand-700">
            Operador
            <input
              type="text"
              value={form.operador}
              onChange={(e) => upd("operador", e.target.value)}
              className={`${fieldCls} mt-1`}
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-brand-700">
              Modelo
              <input
                type="text"
                value={form.modelo}
                onChange={(e) => upd("modelo", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Año
              <input
                type="text"
                value={form.anio}
                onChange={(e) => upd("anio", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Placas tracto
              <input
                type="text"
                value={form.placas_tracto}
                onChange={(e) => upd("placas_tracto", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Placas caja
              <input
                type="text"
                value={form.placas_caja}
                onChange={(e) => upd("placas_caja", e.target.value)}
                className={`${fieldCls} mt-1`}
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-brand-700">
            Contacto
            <input
              type="text"
              value={form.contacto_unidad}
              onChange={(e) => upd("contacto_unidad", e.target.value)}
              className={`${fieldCls} mt-1`}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

type ViajeEditData = {
  lugar_inicio: string;
  lugar_fin: string;
  fecha_inicio: string;
  fecha_fin: string;
  flete_cargo: string;
  responsable_id: string;
};

export function ViajeDetail({
  viaje: initialViaje,
  lecturas: initialLecturas,
  alertas,
  termografos: initialTermografos,
  auditoria,
}: {
  viaje: Viaje;
  lecturas: LecturaTemperatura[];
  alertas: AlertaLog[];
  termografos: Termografo[];
  auditoria: Auditoria[];
}) {
  const router = useRouter();
  const [viaje, setViaje] = useState(initialViaje);
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>(initialViaje.ordenes_venta ?? []);
  const [lecturas, setLecturas] = useState(initialLecturas);
  const [termografos, setTermografos] = useState<Termografo[]>(initialTermografos);
  const [activeTermografoIdx, setActiveTermografoIdx] = useState(0);

  // Viaje edit
  const [editingViaje, setEditingViaje] = useState(false);
  const [savingViaje, setSavingViaje] = useState(false);
  const [viajeEdit, setViajeEdit] = useState<ViajeEditData>({
    lugar_inicio: "",
    lugar_fin: "",
    fecha_inicio: "",
    fecha_fin: "",
    flete_cargo: "",
    responsable_id: "",
  });

  // Termógrafo modal
  const [showTermografoModal, setShowTermografoModal] = useState(false);

  // Datos del viaje (unidad) modal
  const [showDatosViaje, setShowDatosViaje] = useState(false);
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([]);

  // OV form
  const [showOVForm, setShowOVForm] = useState(false);
  const [editingOVPanel, setEditingOVPanel] = useState<OrdenVenta | null>(null);
  const [detailOV, setDetailOV] = useState<OrdenVenta | null>(null);
  const [detailOVEdit, setDetailOVEdit] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [combinaciones, setCombinaciones] = useState<ProductoCombinacion[]>([]);
  const [clientes, setClientes] = useState<ClienteConCedis[]>([]);
  const [lugaresOV, setLugaresOV] = useState<{ id: string; nombre: string }[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [usuarios, setUsuarios] = useState<
    { id: string; nombre: string | null; email: string | null }[]
  >([]);

  const position =
    viaje.lat != null && viaje.lng != null
      ? { lat: Number(viaje.lat), lng: Number(viaje.lng) }
      : null;

  const path = [...lecturas]
    .filter((l) => l.lat != null && l.lng != null)
    .reverse()
    .map((l) => ({ lat: Number(l.lat), lng: Number(l.lng) }));

  const tempRanges = useMemo(
    () => ordenes.map((o) => o.producto).filter(Boolean) as Producto[],
    [ordenes]
  );
  const tempMin = useMemo(
    () => (tempRanges.length > 0 ? Math.max(...tempRanges.map((p) => Number(p.temp_min))) : null),
    [tempRanges]
  );
  const tempMax = useMemo(
    () => (tempRanges.length > 0 ? Math.min(...tempRanges.map((p) => Number(p.temp_max))) : null),
    [tempRanges]
  );

  const lecturasByTermografo = useMemo(() => {
    const map = new Map<string, LecturaTemperatura[]>();
    for (const l of lecturas) {
      const list = map.get(l.termografo_id) ?? [];
      list.push(l);
      map.set(l.termografo_id, list);
    }
    return map;
  }, [lecturas]);

  const tempDeCarga = useMemo(() => {
    if (termografos.length === 0) return null;
    const latest = termografos
      .map((t) => {
        const tLecturas = lecturasByTermografo.get(t.id) ?? [];
        return tLecturas[0]?.temperatura != null ? Number(tLecturas[0].temperatura) : null;
      })
      .filter((v): v is number => v !== null);
    if (latest.length === 0) return null;
    return latest.reduce((a, b) => a + b, 0) / latest.length;
  }, [termografos, lecturasByTermografo]);

  async function loadFormData() {
    const fetches = [];
    if (productos.length === 0)
      fetches.push(
        fetch("/api/productos")
          .then((r) => r.json())
          .then((j) => setProductos(j.data ?? []))
      );
    if (combinaciones.length === 0)
      fetches.push(
        fetch("/api/productos/combinaciones")
          .then((r) => r.json())
          .then((j) => setCombinaciones(j.data ?? []))
      );
    if (clientes.length === 0)
      fetches.push(
        fetch("/api/clientes")
          .then((r) => r.json())
          .then((j) => setClientes(j.data ?? []))
      );
    if (lugaresOV.length === 0)
      fetches.push(
        fetch("/api/lugares")
          .then((r) => r.json())
          .then((j) => setLugaresOV(j.data ?? []))
      );
    await Promise.all(fetches);
  }

  async function loadTransportistas() {
    if (transportistas.length === 0) {
      const j = await fetch("/api/transportistas").then((r) => r.json());
      setTransportistas(j.data ?? []);
    }
  }

  async function loadConcesionarios() {
    if (concesionarios.length === 0) {
      const j = await fetch("/api/concesionarios").then((r) => r.json());
      setConcesionarios(j.data ?? []);
    }
  }

  async function loadUsuarios() {
    if (usuarios.length === 0) {
      const j = await fetch("/api/usuarios").then((r) => r.json());
      setUsuarios(j.users ?? []);
    }
  }

  async function startEditViaje() {
    setViajeEdit({
      lugar_inicio: viaje.lugar_inicio,
      lugar_fin: viaje.lugar_fin,
      fecha_inicio: viaje.fecha_inicio,
      fecha_fin: viaje.fecha_fin,
      flete_cargo: viaje.flete_cargo ?? "",
      responsable_id: viaje.responsable_id ?? "",
    });
    await Promise.all([loadTransportistas(), loadUsuarios()]);
    setEditingViaje(true);
  }

  async function saveViaje() {
    setSavingViaje(true);
    const res = await fetch(`/api/viajes/${viaje.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lugar_inicio: viajeEdit.lugar_inicio,
        lugar_fin: viajeEdit.lugar_fin,
        fecha_inicio: viajeEdit.fecha_inicio,
        fecha_fin: viajeEdit.fecha_fin,
        flete_cargo: viajeEdit.flete_cargo || null,
        responsable_id: viajeEdit.responsable_id || null,
      }),
    });
    setSavingViaje(false);
    if (res.ok) {
      const newResponsable = viajeEdit.responsable_id
        ? (usuarios.find((u) => u.id === viajeEdit.responsable_id) ?? null)
        : null;
      setViaje((prev) => ({
        ...prev,
        lugar_inicio: viajeEdit.lugar_inicio,
        lugar_fin: viajeEdit.lugar_fin,
        fecha_inicio: viajeEdit.fecha_inicio,
        fecha_fin: viajeEdit.fecha_fin,
        flete_cargo: viajeEdit.flete_cargo || null,
        responsable_id: viajeEdit.responsable_id || null,
        responsable: newResponsable,
      }));
      setEditingViaje(false);
      toast.success("Viaje actualizado");
      router.refresh();
    } else {
      const json = await res.json();
      toast.error(json.error || "Error al guardar");
    }
  }


  async function handleOVSaved(ov: OrdenVenta) {
    setOrdenes((prev) => {
      const idx = prev.findIndex((o) => o.id === ov.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = ov;
        return next;
      }
      return [...prev, ov];
    });
    setShowOVForm(false);
    setEditingOVPanel(null);
    router.refresh();
  }

  async function handleDeleteOV(ov: OrdenVenta) {
    if (!confirm(`¿Eliminar OV ${ov.ov_ref}?`)) return;
    const res = await fetch(`/api/viajes/${viaje.id}/ordenes/${ov.id}`, { method: "DELETE" });
    if (res.ok) {
      setOrdenes((prev) => prev.filter((o) => o.id !== ov.id));
      toast.success("OV eliminada");
      router.refresh();
    } else {
      toast.error("Error al eliminar");
    }
  }

  async function updateOVStatus(ov: OrdenVenta, next: Status) {
    const res = await fetch(`/api/viajes/${viaje.id}/ordenes/${ov.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setOrdenes((prev) => prev.map((o) => (o.id === ov.id ? { ...o, status: next } : o)));
    } else {
      toast.error("Error al actualizar status");
    }
  }

  async function openOVDetail(ov: OrdenVenta, startEditing = false) {
    await loadFormData();
    setDetailOVEdit(startEditing);
    setDetailOV(ov);
  }

  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`viaje-${viaje.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "viajes", filter: `id=eq.${viaje.id}` },
        (payload) => setViaje((prev) => ({ ...prev, ...(payload.new as Partial<Viaje>) }))
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lecturas_temperatura",
          filter: `viaje_id=eq.${viaje.id}`,
        },
        (payload) => {
          const row = payload.new as LecturaTemperatura;
          setLecturas((prev) => [row, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      fetch(`/api/copeland/sync?viajeId=${viaje.id}`, { method: "POST" })
        .catch(() => void 0)
        .finally(() => router.refresh());
    }, 3 * 60_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [viaje.id, router]);

  const showOVFormPanel = showOVForm || editingOVPanel !== null;

  return (
    <div className="space-y-6">

      {/* Modal datos del viaje (unidad) */}
      {showDatosViaje && (
        <DatosViajeModal
          viaje={viaje}
          concesionarios={concesionarios}
          onClose={() => setShowDatosViaje(false)}
          onSaved={(v) => {
            setViaje(v);
            router.refresh();
          }}
        />
      )}

      {/* Modal termógrafo */}
      {showTermografoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowTermografoModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-brand-100 p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <TermografoModalContent
              viajeId={viaje.id}
              onClose={() => setShowTermografoModal(false)}
              onAdded={(updated) => {
                setTermografos(updated);
                setShowTermografoModal(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}

      {/* Modal detalle OV */}
      {detailOV && (
        <OVDetailModal
          ov={detailOV}
          viaje_id={viaje.id}
          productos={productos}
          combinaciones={combinaciones}
          clientes={clientes}
          initialEditing={detailOVEdit}
          onClose={() => setDetailOV(null)}
          onSaved={(updated) => {
            setOrdenes((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            setDetailOV(updated);
            router.refresh();
          }}
          onDelete={async (ovToDelete) => {
            setDetailOV(null);
            await handleDeleteOV(ovToDelete);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-brand-400 mb-1">
            Viaje #{String(viaje.numero).padStart(4, "0")}
          </div>
          <h1 className="font-display font-bold text-2xl text-brand-900 tracking-tight">
            {viaje.lugar_inicio}
            <span className="text-brand-300 mx-2.5">→</span>
            {viaje.lugar_fin}
          </h1>
          <div className="mt-1 text-sm text-brand-500">
            {viaje.fecha_inicio} — {viaje.fecha_fin}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {editingViaje ? (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingViaje(false)}
                disabled={savingViaje}
                className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveViaje}
                disabled={savingViaje}
                className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition shadow-sm"
              >
                {savingViaje ? "Guardando…" : "Guardar"}
              </button>
            </div>
          ) : (
            <button
              onClick={startEditViaje}
              className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
            >
              Editar viaje
            </button>
          )}
        </div>
      </div>

      <AlertaBanner
        active={!!viaje.alerta_activa}
        tempActual={viaje.temp_actual != null ? Number(viaje.temp_actual) : null}
        tempMin={tempMin}
        tempMax={tempMax}
      />

      {/* Órdenes de Venta */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
            Logística
          </span>
          <div className="flex-1 h-px bg-brand-100" />
          {!showOVFormPanel && (
            <button
              onClick={async () => {
                await loadFormData();
                setShowOVForm(true);
              }}
              className="rounded-xl bg-brand-900 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition shadow-sm"
            >
              + Agregar Carga
            </button>
          )}
        </div>

        <div className="space-y-3">
          {showOVFormPanel && (
            <OVFormPanel
              key={editingOVPanel?.id ?? "new"}
              viaje_id={viaje.id}
              editingOV={editingOVPanel}
              productos={productos}
              combinaciones={combinaciones}
              clientes={clientes}
              lugaresCarga={lugaresOV}
              onSaved={handleOVSaved}
              onCancel={() => {
                setShowOVForm(false);
                setEditingOVPanel(null);
              }}
            />
          )}

          {ordenes.length === 0 && !showOVFormPanel ? (
            <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center bg-white">
              <svg className="w-8 h-8 mx-auto mb-3 text-brand-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <p className="text-sm font-medium text-brand-600">Sin cargas</p>
              <p className="text-xs text-brand-400 mt-1">Agrega la primera carga para este viaje.</p>
            </div>
          ) : (
            ordenes.length > 0 && (
              <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-brand-50 text-xs uppercase tracking-widest text-brand-400">
                        <th className="text-left px-4 py-3 font-medium">OV / REF</th>
                        <th className="text-left px-4 py-3 font-medium">Cliente</th>
                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                          Carga
                        </th>
                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                          Cita
                        </th>
                        <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                          Producto
                        </th>
                        <th className="text-left px-4 py-3 font-medium">Estatus</th>
                        <th className="text-right px-4 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-50">
                      {ordenes.map((ov) => (
                        <tr
                          key={ov.id}
                          onClick={() => openOVDetail(ov)}
                          className="hover:bg-brand-50/40 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                              {ov.ov_ref}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-brand-900">{ov.cliente}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">
                            <div>{ov.fecha_carga}</div>
                            <div className="text-brand-400">{ov.lugar_carga}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">
                            {ov.tiene_cita && ov.fecha_entrega ? (
                              <div>
                                {ov.fecha_entrega}
                                {ov.cita ? ` · ${to12h(ov.cita)}` : ""}
                              </div>
                            ) : (
                              <div className="text-brand-300">—</div>
                            )}
                            {ov.cedi && <div className="text-brand-400">{ov.cedi}</div>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-brand-500">
                            {ov.producto?.nombre ??
                              (ov.combo
                                ? `${ov.combo.producto_a.nombre} + ${ov.combo.producto_b.nombre}`
                                : "—")}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={ov.status}
                              onChange={(e) => updateOVStatus(ov, e.target.value as Status)}
                              className="text-xs rounded-lg border border-brand-200 px-2 py-1 bg-white text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              {STATUS_VALUES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={async () => {
                                await loadFormData();
                                setShowOVForm(false);
                                setEditingOVPanel(ov);
                              }}
                              className="text-xs text-brand-500 hover:text-brand-900 transition"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Datos del viaje */}
      <div>
        <SectionHeader>Datos del viaje</SectionHeader>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {editingViaje ? (
            <EditCell label="Lugar de inicio">
              <CiudadCombobox
                value={viajeEdit.lugar_inicio}
                onChange={(v) => setViajeEdit((prev) => ({ ...prev, lugar_inicio: v }))}
                placeholder="Hermosillo"
                inputClassName={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Lugar de inicio" value={viaje.lugar_inicio} />
          )}

          {editingViaje ? (
            <EditCell label="Lugar de fin">
              <CiudadCombobox
                value={viajeEdit.lugar_fin}
                onChange={(v) => setViajeEdit((prev) => ({ ...prev, lugar_fin: v }))}
                placeholder="Tijuana"
                inputClassName={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Lugar de fin" value={viaje.lugar_fin} />
          )}

          <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">Flete / Unidad</div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-brand-900 min-w-0 truncate">
                {viaje.linea?.concesionario?.nombre
                  ? `${viaje.linea.concesionario.nombre}${viaje.linea?.nombre ? ` · ${viaje.linea.nombre}` : ""}`
                  : viaje.flete_cargo ?? "—"}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await loadConcesionarios();
                  setShowDatosViaje(true);
                }}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition shrink-0 whitespace-nowrap"
              >
                Datos del viaje
              </button>
            </div>
          </div>

          {editingViaje ? (
            <EditCell label="Fecha de inicio">
              <input
                type="date"
                value={viajeEdit.fecha_inicio}
                onChange={(e) => setViajeEdit((v) => ({ ...v, fecha_inicio: e.target.value }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Fecha de inicio" value={viaje.fecha_inicio} />
          )}

          {editingViaje ? (
            <EditCell label="Fecha de fin">
              <input
                type="date"
                value={viajeEdit.fecha_fin}
                onChange={(e) => setViajeEdit((v) => ({ ...v, fecha_fin: e.target.value }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Fecha de fin" value={viaje.fecha_fin} />
          )}

          {/* Responsable */}
          {editingViaje ? (
            <EditCell label="Responsable">
              <select
                value={viajeEdit.responsable_id}
                onChange={(e) =>
                  setViajeEdit((v) => ({ ...v, responsable_id: e.target.value }))
                }
                className={bareSelect}
              >
                <option value="">— Sin responsable —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre ?? u.email}
                  </option>
                ))}
              </select>
            </EditCell>
          ) : (
            <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">
                Responsable
              </div>
              {viaje.responsable ? (
                <div className="flex items-center gap-2.5">
                  <ResponsableAvatar responsable={viaje.responsable} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-brand-900 truncate">
                      {viaje.responsable.nombre ?? viaje.responsable.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-brand-300">—</div>
              )}
            </div>
          )}

          {/* Termógrafos */}
          <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">
              Termógrafos
            </div>
            <div className="space-y-1.5">
              {termografos.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium font-mono text-brand-900">{t.id}</span>
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `/api/viajes/${viaje.id}/termografos/${encodeURIComponent(t.id)}`,
                        { method: "DELETE" }
                      );
                      if (res.ok) {
                        setTermografos((prev) => prev.filter((x) => x.id !== t.id));
                        setActiveTermografoIdx(0);
                        toast.success("Termógrafo desconectado");
                        router.refresh();
                      } else {
                        toast.error("Error al desconectar");
                      }
                    }}
                    className="text-xs text-brand-400 hover:text-red-500 transition"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                onClick={() => setShowTermografoModal(true)}
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-400 transition w-full text-left mt-1"
              >
                + Agregar termógrafo
              </button>
            </div>
          </div>

          <InfoCell
            label="Última lectura"
            value={
              viaje.ultima_lectura
                ? new Date(viaje.ultima_lectura).toLocaleString("es-MX")
                : "—"
            }
          />

          {/* Temperatura de carga */}
          {termografos.length > 0 && (
            <div className="rounded-xl border border-brand-100 bg-white px-4 py-3 flex flex-col items-center justify-center text-center">
              <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">
                Temperatura de carga
              </div>
              <div className="text-2xl font-bold text-brand-900">
                {tempDeCarga != null ? `${(cToF(tempDeCarga) as number).toFixed(1)}°F` : "—"}
              </div>
              {termografos.length > 1 && (
                <div className="text-[11px] text-brand-400 mt-1">
                  Promedio de {termografos.length} termógrafos
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Monitoreo */}
      <div>
        <SectionHeader>Monitoreo</SectionHeader>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-brand-100 bg-white overflow-hidden h-96 shadow-[0_1px_16px_-6px_rgba(0,0,0,0.08)]">
            <MapaTracker
              position={position}
              path={path}
              outOfRange={!!viaje.alerta_activa}
              title={`Viaje #${String(viaje.numero).padStart(4, "0")}`}
            />
          </div>
          <div className="space-y-3">
            {tempMin != null && tempMax != null ? (
              termografos.length > 0 ? (
                <div>
                  {/* Carousel header */}
                  {termografos.length > 1 && (
                    <div className="flex items-center justify-between mb-3 px-0.5">
                      <button
                        onClick={() => setActiveTermografoIdx((i) => Math.max(0, i - 1))}
                        disabled={activeTermografoIdx === 0}
                        className="rounded-lg p-1.5 hover:bg-brand-50 disabled:opacity-30 transition text-brand-600"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-brand-700">
                          {termografos[activeTermografoIdx]?.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {termografos.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveTermografoIdx(i)}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                i === activeTermografoIdx ? "bg-brand-700" : "bg-brand-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-brand-400">
                          {activeTermografoIdx + 1}/{termografos.length}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          setActiveTermografoIdx((i) => Math.min(termografos.length - 1, i + 1))
                        }
                        disabled={activeTermografoIdx === termografos.length - 1}
                        className="rounded-lg p-1.5 hover:bg-brand-50 disabled:opacity-30 transition text-brand-600"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Slides */}
                  <div className="overflow-hidden">
                    <div
                      className="flex transition-transform duration-300 ease-in-out"
                      style={{ transform: `translateX(-${activeTermografoIdx * 100}%)` }}
                    >
                      {termografos.map((t) => {
                        const tLecturas = lecturasByTermografo.get(t.id) ?? [];
                        const latestTemp =
                          tLecturas[0]?.temperatura != null
                            ? Number(tLecturas[0].temperatura)
                            : null;
                        return (
                          <div key={t.id} className="min-w-full space-y-3">
                            <TempGauge value={latestTemp} min={tempMin} max={tempMax} />
                            <TempChart
                              lecturas={tLecturas}
                              min={tempMin}
                              max={tempMax}
                              viajeId={viaje.id}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-200 p-10 bg-white text-center">
                  <svg className="w-8 h-8 mx-auto mb-3 text-brand-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                  </svg>
                  <p className="text-sm font-medium text-brand-600">Sin termógrafo asignado</p>
                  <p className="text-xs text-brand-400 mt-1">Agrega un termógrafo en los datos del viaje.</p>
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-200 p-10 bg-white text-center">
                <svg className="w-8 h-8 mx-auto mb-3 text-brand-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                </svg>
                <p className="text-sm font-medium text-brand-600">Sin datos de temperatura</p>
                <p className="text-xs text-brand-400 mt-1">Agrega una OV con producto para habilitar el monitoreo.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial */}
      <div>
        <SectionHeader>Historial</SectionHeader>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-50 font-display font-semibold text-sm text-brand-900 uppercase tracking-widest">
              Últimas lecturas
            </div>
            {lecturas.length === 0 ? (
              <div className="p-6 text-sm text-brand-400 text-center">Sin lecturas aún.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-xs uppercase text-brand-400 tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Hora</th>
                    <th className="text-left px-4 py-2">Temp</th>
                    <th className="text-left px-4 py-2 hidden sm:table-cell">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturas.slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-t border-brand-50">
                      <td className="px-4 py-2 text-brand-600 tabular-nums">
                        {new Date(l.timestamp).toLocaleTimeString("es-MX")}
                      </td>
                      <td
                        className={`px-4 py-2 font-semibold tabular-nums ${
                          l.fuera_rango ? "text-red-600" : "text-brand-900"
                        }`}
                      >
                        {(cToF(Number(l.temperatura)) as number).toFixed(1)}°F
                      </td>
                      <td className="px-4 py-2 text-xs text-brand-400 hidden sm:table-cell">
                        {l.lat != null && l.lng != null
                          ? <GeoCell lat={Number(l.lat)} lng={Number(l.lng)} />
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-50 font-display font-semibold text-sm text-brand-900 uppercase tracking-widest">
              Alertas enviadas
            </div>
            {alertas.length === 0 ? (
              <div className="p-6 text-sm text-brand-400 text-center">Sin alertas.</div>
            ) : (
              <ul className="divide-y divide-brand-50">
                {alertas.map((a) => (
                  <li
                    key={a.id}
                    className="px-5 py-3 text-sm flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${a.tipo === "TEMP_ALTA" ? "bg-red-500" : "bg-blue-400"}`} />
                        <span className="font-medium text-brand-900">
                          {a.tipo === "TEMP_ALTA" ? "Temp. alta" : "Temp. baja"}
                        </span>
                        {a.temperatura != null && (
                          <span className="text-brand-500 font-normal tabular-nums">
                            {(cToF(Number(a.temperatura)) as number).toFixed(1)}°F
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-brand-400 mt-0.5">
                        {new Date(a.created_at).toLocaleString("es-MX")} · {a.enviado_a}
                      </div>
                    </div>
                    {a.whatsapp_sid ? (
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Enviado
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Sin envío
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Modificaciones */}
      <div>
        <SectionHeader>Modificaciones</SectionHeader>
        <ModificacionesSection numero={viaje.numero} auditoria={auditoria} />
      </div>
    </div>
  );
}
