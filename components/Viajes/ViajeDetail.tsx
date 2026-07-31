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
  RangoTemperatura,
  Responsable,
  Status,
  Termografo,
  Viaje,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";
import { StatusBadge } from "@/components/Cargas/StatusBadge";
import { TempGauge } from "@/components/Temperatura/TempGauge";
import { TempChart } from "@/components/Temperatura/TempChart";
import { AlertaBanner } from "@/components/Alertas/AlertaBanner";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CiudadCombobox } from "@/components/ui/CiudadCombobox";
import { DatePicker } from "@/components/ui/DatePicker";
import { ModificacionesSection } from "@/components/Viajes/ModificacionesSection";
import { cToF, fToC, tempEstado } from "@/lib/temperature";
import { to12h } from "@/lib/time";
import { formatFecha, formatFechaHora } from "@/lib/fecha";
import { viajeConcluido } from "@/lib/viaje";

const MapaTracker = dynamic(() => import("@/components/Mapa/MapaTracker"), { ssr: false });

const _geoCache = new Map<string, string>();

function GeoCell({ lat, lng }: { lat: number; lng: number }) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const [label, setLabel] = useState<string | null>(_geoCache.get(key) ?? null);
  const fetched = useRef(_geoCache.has(key));

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    // Leemos los campos ESTRUCTURADOS (address) en vez de cortar display_name:
    // así la granularidad es siempre Ciudad/Municipio, Estado, País (consistente).
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=10&lat=${lat}&lon=${lng}`,
      { headers: { "Accept-Language": "es-MX,es" } }
    )
      .then((r) => r.json())
      .then((data) => {
        const a = data.address ?? {};
        const ciudad = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null;
        const estado = a.state ?? null;
        const pais = a.country ?? null;
        const partes = [ciudad, estado, pais].filter(Boolean);
        if (partes.length === 0) {
          // Sin datos (incluye respuestas de error/límite): no cacheamos para poder
          // reintentar luego, y NO mostramos coordenadas.
          setLabel("Ubicación no disponible");
          return;
        }
        const result = partes.join(", ");
        _geoCache.set(key, result);
        setLabel(result);
      })
      .catch(() => setLabel("Ubicación no disponible"));
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

// Fase 5: una OV tiene N productos, cada uno con sus cajas (orden_productos).
type OVProductoRow = { producto_id: string; cajas: string };

function ovProductosToRows(ov: OrdenVenta): OVProductoRow[] {
  const rows = (ov.productos ?? []).map((p) => ({
    producto_id: p.producto_id ?? "",
    cajas: p.cajas != null ? String(p.cajas) : "",
  }));
  return rows.length > 0 ? rows : [{ producto_id: "", cajas: "" }];
}

function rowsToPayload(rows: OVProductoRow[]) {
  return rows
    .filter((r) => r.producto_id)
    .map((r) => ({ producto_id: r.producto_id, cajas: r.cajas !== "" ? Number(r.cajas) : null }));
}

// Editor repetible de productos: [producto ▾] [cajas] + "agregar otro producto".
function ProductosEditor({
  rows,
  productos,
  onChange,
}: {
  rows: OVProductoRow[];
  productos: Producto[];
  onChange: (rows: OVProductoRow[]) => void;
}) {
  const setRow = (i: number, patch: Partial<OVProductoRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { producto_id: "", cajas: "" }]);
  const removeRow = (i: number) =>
    onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);

  return (
    <div className="lg:col-span-3 space-y-2">
      <div className="text-xs font-medium text-brand-700">Productos *</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.producto_id}
            onChange={(e) => setRow(i, { producto_id: e.target.value })}
            className="w-64 max-w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          >
            <option value="">Producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={r.cajas}
            onChange={(e) => setRow(i, { cajas: e.target.value })}
            placeholder="cajas"
            className="w-20 shrink-0 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              title="Quitar producto"
              className="shrink-0 rounded-lg border border-brand-200 px-2 py-2 text-brand-400 hover:text-red-500 hover:border-red-200 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs font-medium text-brand-600 hover:text-brand-900 transition"
      >
        + Agregar otro producto
      </button>
    </div>
  );
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
  productos: OVProductoRow[];
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
  productos: [{ producto_id: "", cajas: "" }],
});

function OVFormPanel({
  viaje_id,
  editingOV,
  productos,
  clientes,
  lugaresCarga,
  onSaved,
  onCancel,
}: {
  viaje_id: string;
  editingOV: OrdenVenta | null;
  productos: Producto[];
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
          productos: ovProductosToRows(editingOV),
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

  const clienteCedis =
    clientes.find((c) => c.nombre === form.cliente)?.cedis ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const productos = rowsToPayload(form.productos);
    if (productos.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (clienteCedis.length > 0 && !form.cedi) {
      toast.error("Selecciona un CEDIS");
      return;
    }
    setSaving(true);
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
      productos,
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
          <DatePicker
            required
            value={form.fecha_carga}
            onChange={(v) => upd("fecha_carga", v)}
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
              placeholder=""
              value={form.lugar_carga}
              onChange={(e) => upd("lugar_carga", e.target.value)}
              className={`${fieldCls} mt-1`}
            />
          )}
        </div>
        <ProductosEditor
          rows={form.productos}
          productos={productos}
          onChange={(rows) => upd("productos", rows)}
        />

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
              <DatePicker
                value={form.fecha_entrega}
                onChange={(v) => upd("fecha_entrega", v)}
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
  clientes,
  initialEditing = false,
  onClose,
  onSaved,
  onDelete,
}: {
  ov: OrdenVenta;
  viaje_id: string;
  productos: Producto[];
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
    productos: ovProductosToRows(initialOv),
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
      productos: ovProductosToRows(ov),
    });
    setIsEditing(true);
  }

  const modalClienteCedis =
    clientes.find((c) => c.nombre === form.cliente)?.cedis ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const productosPayload = rowsToPayload(form.productos);
    if (productosPayload.length === 0) { toast.error("Agrega al menos un producto"); return; }
    if (modalClienteCedis.length > 0 && !form.cedi) {
      toast.error("Selecciona un CEDIS");
      return;
    }
    setSaving(true);
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
      productos: productosPayload,
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

  const ovProductos = ov.productos ?? [];

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
                  <DatePicker
                    required
                    value={form.fecha_carga}
                    onChange={(v) => upd("fecha_carga", v)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-brand-700 sm:col-span-2">
                  Lugar de carga *
                  <input
                    type="text"
                    required
                    placeholder=""
                    value={form.lugar_carga}
                    onChange={(e) => upd("lugar_carga", e.target.value)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
              </div>

              {/* Productos + Cajas */}
              <ProductosEditor
                rows={form.productos}
                productos={productos}
                onChange={(rows) => upd("productos", rows)}
              />

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
                      <DatePicker
                        value={form.fecha_entrega}
                        onChange={(v) => upd("fecha_entrega", v)}
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
                  <div className="text-sm font-medium text-brand-900">{formatFecha(ov.fecha_carga)}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{ov.lugar_carga}</div>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Cita</div>
                  {ov.tiene_cita ? (
                    <div className="space-y-0.5">
                      {ov.fecha_entrega && (
                        <div className="text-sm font-medium text-brand-900">
                          {formatFecha(ov.fecha_entrega)}{ov.cita ? ` · ${to12h(ov.cita)}` : ""}
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

              {/* Productos */}
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">
                  Producto{ovProductos.length !== 1 ? "s" : ""}
                </div>
                {ovProductos.length > 0 ? (
                  <div className="space-y-1.5">
                    {ovProductos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-white border border-brand-100 px-3 py-2">
                        <div className="text-sm font-medium text-brand-900 truncate">
                          {p.producto?.nombre ?? "—"}
                        </div>
                        {p.cajas != null && (
                          <div className="text-sm font-bold text-brand-700 ml-2 shrink-0">{p.cajas} cj</div>
                        )}
                      </div>
                    ))}
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
  // Flete = concesionario; la línea pertenece a un flete. Se deriva el flete actual
  // desde la línea asignada, o desde el nombre guardado en flete_cargo (del alta).
  const initialFleteId = (() => {
    if (viaje.linea_transportista_id) {
      const c = concesionarios.find((co) =>
        (co.lineas_transportista ?? []).some((l) => l.id === viaje.linea_transportista_id)
      );
      if (c) return c.id;
    }
    if (viaje.flete_cargo) {
      const c = concesionarios.find((co) => co.nombre === viaje.flete_cargo);
      if (c) return c.id;
    }
    return "";
  })();

  const [fleteId, setFleteId] = useState(initialFleteId);
  const [lineaId, setLineaId] = useState(viaje.linea_transportista_id ?? "");
  const [form, setForm] = useState({
    operador: viaje.operador ?? "",
    modelo: viaje.modelo ?? "",
    anio: viaje.anio ?? "",
    placas_tracto: viaje.placas_tracto ?? "",
    placas_caja: viaje.placas_caja ?? "",
    contacto_unidad: viaje.contacto_unidad ?? "",
  });
  const [saving, setSaving] = useState(false);

  const lineasDelFlete =
    concesionarios.find((c) => c.id === fleteId)?.lineas_transportista ?? [];

  function upd<K extends keyof typeof form>(k: K, val: string) {
    setForm((f) => ({ ...f, [k]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fleteNombre = concesionarios.find((c) => c.id === fleteId)?.nombre ?? null;
    const body = {
      // El flete (concesionario) se persiste como texto en flete_cargo, para que
      // se muestre aunque no se elija línea.
      flete_cargo: fleteNombre,
      linea_transportista_id: lineaId || null,
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
    const selLinea = lineasDelFlete.find((l) => l.id === lineaId);
    const selConces = concesionarios.find((c) => c.id === fleteId);
    const linea =
      selLinea && selConces
        ? { id: selLinea.id, nombre: selLinea.nombre, concesionario: { id: selConces.id, nombre: selConces.nombre } }
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
            Flete (transportista)
            <select
              value={fleteId}
              onChange={(e) => {
                setFleteId(e.target.value);
                setLineaId(""); // la línea pertenece al flete: se reinicia al cambiarlo
              }}
              className={`${fieldCls} bg-white mt-1`}
            >
              <option value="">— Sin flete —</option>
              {concesionarios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-brand-700">
            Línea transportista
            <select
              value={lineaId}
              onChange={(e) => setLineaId(e.target.value)}
              disabled={!fleteId || lineasDelFlete.length === 0}
              className={`${fieldCls} bg-white mt-1 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <option value="">
                {!fleteId
                  ? "— Elige un flete primero —"
                  : lineasDelFlete.length === 0
                    ? "— Sin líneas para este flete —"
                    : "— Sin línea —"}
              </option>
              {lineasDelFlete.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
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

// Cambio 2 — Modal de rechazo de cargas (3 pasos):
//   Paso 1: elegir qué cargas rechazar (la que disparó el flujo viene marcada).
//   Paso 2: (opcional) datos del viaje nuevo para re-rutearlas.
//   Paso 3: (opcional) qué termógrafos transferir al viaje nuevo.
// "Solo rechazar" termina en el Paso 1. Idempotencia: el id del viaje nuevo se
// genera aquí (crypto.randomUUID) una sola vez por apertura del flujo.
const REJECTABLE_STATUSES: Status[] = ["PENDIENTE", "EN_PREPARACION", "TRANSITO"];

// Override por carga para la copia en el viaje nuevo (Cambio 2): OV/REF nueva,
// cliente y CEDIS (destino). Los demás campos se heredan de la carga original.
type OvOverride = { ov_ref: string; cliente: string; cedi: string };

// Editor de una carga NUEVA (creada desde cero) para el viaje nuevo del rechazo.
// Usa el mismo set de datos que una OV normal (OVFormData) y es repetible.
function NuevaCargaCard({
  form,
  productos,
  clientes,
  lugares,
  onChange,
  onRemove,
}: {
  form: OVFormData;
  productos: Producto[];
  clientes: ClienteConCedis[];
  lugares: { id: string; nombre: string }[];
  onChange: (f: OVFormData) => void;
  onRemove: () => void;
}) {
  const upd = <K extends keyof OVFormData>(k: K, v: OVFormData[K]) => onChange({ ...form, [k]: v });
  const cedisDelCliente = clientes.find((c) => c.nombre === form.cliente)?.cedis ?? [];
  const [lugarLibre, setLugarLibre] = useState<boolean>(
    () => lugares.length === 0 || (!!form.lugar_carga && !lugares.some((l) => l.nombre === form.lugar_carga))
  );

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-brand-700">Carga nueva</div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-brand-400 hover:text-red-500 transition"
        >
          Quitar
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
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
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-brand-700">
          Cliente *
          <select
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
        {cedisDelCliente.length > 0 && (
          <label className="block text-xs font-medium text-brand-700">
            CEDIS *
            <select
              value={form.cedi}
              onChange={(e) => upd("cedi", e.target.value)}
              className={`${fieldCls} bg-white mt-1`}
            >
              <option value="">— Selecciona CEDIS —</option>
              {cedisDelCliente.map((d) => (
                <option key={d.id} value={d.nombre}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs font-medium text-brand-700">
          Fecha de carga *
          <DatePicker
            value={form.fecha_carga}
            onChange={(v) => upd("fecha_carga", v)}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <div className="block text-xs font-medium text-brand-700">
          Lugar de carga *
          {lugares.length > 0 ? (
            <div className="mt-1 space-y-1.5">
              <select
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
                {lugares.map((l) => (
                  <option key={l.id} value={l.nombre}>
                    {l.nombre}
                  </option>
                ))}
                <option value="__otro__">Otro (texto libre)…</option>
              </select>
              {lugarLibre && (
                <input
                  type="text"
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
              value={form.lugar_carga}
              onChange={(e) => upd("lugar_carga", e.target.value)}
              className={`${fieldCls} mt-1`}
            />
          )}
        </div>
      </div>

      <ProductosEditor
        rows={form.productos}
        productos={productos}
        onChange={(rows) => upd("productos", rows)}
      />

      <label className="block text-xs font-medium text-brand-700">
        Instrucciones
        <textarea
          rows={2}
          value={form.instrucciones}
          onChange={(e) => upd("instrucciones", e.target.value)}
          className={`${fieldCls} mt-1 resize-none`}
        />
      </label>

      <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-brand-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.tiene_cita}
            onChange={(e) => upd("tiene_cita", e.target.checked)}
            className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
          />
          ¿Existe cita?
        </label>
        {form.tiene_cita && (
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-brand-700">
              PO
              <input type="text" value={form.po} onChange={(e) => upd("po", e.target.value)} className={`${fieldCls} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Folio de cita
              <input type="text" value={form.folio_cita} onChange={(e) => upd("folio_cita", e.target.value)} className={`${fieldCls} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-brand-700">
              Fecha de la cita
              <DatePicker value={form.fecha_entrega} onChange={(v) => upd("fecha_entrega", v)} className={`${fieldCls} mt-1`} />
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
              <input type="text" value={form.factura_gys} onChange={(e) => upd("factura_gys", e.target.value)} className={`${fieldCls} mt-1`} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function RechazoModal({
  viaje,
  ordenes,
  clientes,
  productos,
  lugares,
  termografosActivos,
  initialOvId,
  onClose,
  onDone,
}: {
  viaje: Viaje;
  ordenes: OrdenVenta[];
  clientes: ClienteConCedis[];
  productos: Producto[];
  lugares: { id: string; nombre: string }[];
  termografosActivos: Termografo[];
  initialOvId: string;
  onClose: () => void;
  onDone: (result: {
    rechazadas: string[];
    nuevo_viaje: { id: string; numero: number } | null;
  }) => void;
}) {
  const rechazables = useMemo(
    () => ordenes.filter((o) => REJECTABLE_STATUSES.includes(o.status)),
    [ordenes]
  );
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  // Preselecciona la carga que disparó el flujo solo si es rechazable.
  const [selOv, setSelOv] = useState<Set<string>>(() =>
    rechazables.some((o) => o.id === initialOvId) ? new Set([initialOvId]) : new Set()
  );
  const [selTermo, setSelTermo] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    lugar_inicio: viaje.lugar_inicio,
    lugar_fin: viaje.lugar_fin,
    fecha_inicio: viaje.fecha_inicio,
    fecha_fin: viaje.fecha_fin,
  });
  // Overrides por carga (keyed por origen_ov_id). Se completan bajo demanda.
  const [ovOverrides, setOvOverrides] = useState<Record<string, OvOverride>>({});
  // Cargas NUEVAS (creadas desde cero) que se agregan al viaje nuevo.
  const [cargasNuevas, setCargasNuevas] = useState<OVFormData[]>([]);
  const hoy = new Date().toISOString().slice(0, 10);

  // Default de una carga: OV/REF vacía (se captura nueva), cliente/CEDIS heredados.
  function defaultOverride(id: string): OvOverride {
    const orig = ordenes.find((o) => o.id === id);
    return { ov_ref: "", cliente: orig?.cliente ?? "", cedi: orig?.cedi ?? "" };
  }
  function getOverride(id: string): OvOverride {
    return ovOverrides[id] ?? defaultOverride(id);
  }
  function setOverride(id: string, patch: Partial<OvOverride>) {
    setOvOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? defaultOverride(id)), ...patch },
    }));
  }

  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    set((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Advertencia: si te llevas TODOS los termógrafos activos y el viaje origen aún
  // quedará con cargas activas (ni rechazadas ahora ni entregadas), esas cargas
  // se quedan sin monitoreo. Se advierte pero se permite continuar.
  const cargasQuedanActivas = ordenes.some(
    (o) => !selOv.has(o.id) && o.status !== "ENTREGADO" && o.status !== "RECHAZO_CALIDAD"
  );
  const seLlevaTodos =
    termografosActivos.length > 0 && selTermo.size === termografosActivos.length;
  const warnSinTermografo = cargasQuedanActivas && seLlevaTodos;

  async function submit(crearViaje: boolean) {
    if (selOv.size === 0) {
      toast.error("Selecciona al menos una carga");
      return;
    }
    if (crearViaje) {
      if (!form.lugar_inicio || !form.lugar_fin || !form.fecha_inicio || !form.fecha_fin) {
        toast.error("Completa origen, destino y fechas del viaje nuevo");
        return;
      }
      // Validar datos por carga: cliente obligatorio; CEDIS obligatorio si el
      // cliente tiene CEDIS (mismo criterio que el formulario de carga).
      for (const id of selOv) {
        const ovr = getOverride(id);
        if (!ovr.cliente) {
          toast.error("Cada carga necesita un cliente");
          return;
        }
        const cedisDelCliente = clientes.find((c) => c.nombre === ovr.cliente)?.cedis ?? [];
        if (cedisDelCliente.length > 0 && !ovr.cedi) {
          toast.error("Selecciona el CEDIS (destino) de cada carga");
          return;
        }
      }
      // Validar cargas nuevas (creadas desde cero) con el mismo criterio que una OV.
      for (const nueva of cargasNuevas) {
        if (!nueva.cliente || !nueva.fecha_carga || !nueva.lugar_carga) {
          toast.error("Completa cliente, fecha y lugar de carga de las cargas nuevas");
          return;
        }
        const cedisNueva = clientes.find((c) => c.nombre === nueva.cliente)?.cedis ?? [];
        if (cedisNueva.length > 0 && !nueva.cedi) {
          toast.error("Selecciona el CEDIS de las cargas nuevas");
          return;
        }
        if (rowsToPayload(nueva.productos).length === 0) {
          toast.error("Cada carga nueva necesita al menos un producto");
          return;
        }
      }
    }
    setSubmitting(true);
    const body = crearViaje
      ? {
          ov_ids: Array.from(selOv),
          crear_viaje: true,
          nuevo_viaje_id: crypto.randomUUID(),
          viaje: {
            lugar_inicio: form.lugar_inicio,
            lugar_fin: form.lugar_fin,
            fecha_inicio: form.fecha_inicio,
            fecha_fin: form.fecha_fin,
            flete_cargo: viaje.flete_cargo,
            responsable_id: viaje.responsable_id,
            linea_transportista_id: viaje.linea_transportista_id,
            temp_min: viaje.temp_min,
            temp_max: viaje.temp_max,
            temp_rango_id: viaje.temp_rango_id ?? null,
          },
          termografo_ids: Array.from(selTermo),
          // Datos capturados por carga para la copia (OV/REF nueva, cliente, CEDIS).
          ovs: Array.from(selOv).map((id) => {
            const ovr = getOverride(id);
            return {
              origen_ov_id: id,
              ov_ref: ovr.ov_ref.trim() || null,
              cliente: ovr.cliente || undefined,
              cedi: ovr.cedi || null,
            };
          }),
          // Cargas nuevas creadas desde cero para el viaje nuevo.
          ovs_extra: cargasNuevas.map((n) => ({
            ov_ref: n.ov_ref.trim() || null,
            cliente: n.cliente,
            cedi: n.cedi || null,
            fecha_carga: n.fecha_carga,
            lugar_carga: n.lugar_carga,
            fecha_entrega: n.tiene_cita ? n.fecha_entrega || null : null,
            cita: n.tiene_cita ? n.cita || null : null,
            tiene_cita: n.tiene_cita,
            po: n.tiene_cita ? n.po || null : null,
            folio_cita: n.tiene_cita ? n.folio_cita || null : null,
            factura_gys: n.tiene_cita ? n.factura_gys || null : null,
            status: n.status,
            instrucciones: n.instrucciones,
            productos: rowsToPayload(n.productos),
          })),
        }
      : { ov_ids: Array.from(selOv), crear_viaje: false };

    const res = await fetch(`/api/viajes/${viaje.id}/rechazo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      toast.error(json.error || "Error al rechazar");
      return;
    }
    onDone({ rechazadas: json.rechazadas ?? [], nuevo_viaje: json.nuevo_viaje ?? null });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-brand-50">
          <div className="font-display font-bold text-red-600">Rechazar cargas</div>
          <div className="text-xs text-brand-400 mt-1">
            Viaje #{String(viaje.numero).padStart(4, "0")} · Paso {paso} de {paso === 1 ? "1 o 3" : 3}
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* Paso 1 — seleccionar cargas */}
          {paso === 1 && (
            <>
              <p className="text-sm text-brand-500">
                Selecciona las cargas a rechazar. Se conservará todo su historial; ya no
                mostrarán nuevas mediciones ni alertas.
              </p>
              {rechazables.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-200 p-6 text-center text-sm text-brand-400">
                  No hay cargas rechazables (todas están entregadas o ya rechazadas).
                </div>
              ) : (
                rechazables.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-200 px-4 py-3 cursor-pointer hover:bg-brand-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selOv.has(o.id)}
                      onChange={() => toggle(setSelOv, o.id)}
                      className="h-4 w-4 rounded border-brand-300 text-red-600 focus:ring-red-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                          {o.ov_ref || "—"}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="text-sm font-medium text-brand-900 mt-0.5 truncate">
                        {o.cliente}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </>
          )}

          {/* Paso 2 — datos del viaje nuevo */}
          {paso === 2 && (
            <>
              <p className="text-sm text-brand-500">
                Se creará un <span className="font-semibold text-brand-700">viaje nuevo</span> con
                las cargas seleccionadas (copiadas, en estado Pendiente). Ajusta la ruta y fechas
                del viaje, y captura la nueva OV, cliente y destino de cada carga abajo.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-brand-700 mb-1">Origen</div>
                  <CiudadCombobox
                    value={form.lugar_inicio}
                    onChange={(v) => setForm((f) => ({ ...f, lugar_inicio: v }))}
                    placeholder="Lugar de inicio"
                    inputClassName={fieldCls}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-brand-700 mb-1">Destino</div>
                  <CiudadCombobox
                    value={form.lugar_fin}
                    onChange={(v) => setForm((f) => ({ ...f, lugar_fin: v }))}
                    placeholder="Lugar de fin"
                    inputClassName={fieldCls}
                  />
                </div>
                <label className="block text-xs font-medium text-brand-700">
                  Fecha inicio
                  <DatePicker
                    value={form.fecha_inicio}
                    onChange={(v) => setForm((f) => ({ ...f, fecha_inicio: v }))}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-brand-700">
                  Fecha fin
                  <DatePicker
                    value={form.fecha_fin}
                    onChange={(v) => setForm((f) => ({ ...f, fecha_fin: v }))}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
              </div>
              <div className="text-[11px] text-brand-400">
                El rango de temperatura y el flete se copian del viaje original (editables luego).
              </div>

              {/* Editor por carga: OV/REF nueva, cliente y CEDIS (destino) */}
              <div className="pt-2 space-y-3">
                <div className="text-xs font-semibold text-brand-700">Cargas del viaje nuevo</div>
                {Array.from(selOv).map((id) => {
                  const orig = ordenes.find((o) => o.id === id);
                  const ovr = getOverride(id);
                  const cedisDelCliente =
                    clientes.find((c) => c.nombre === ovr.cliente)?.cedis ?? [];
                  return (
                    <div key={id} className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-2">
                      <div className="text-[11px] text-brand-400">
                        Original: {orig?.ov_ref || "sin ref"} · {orig?.cliente}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-brand-700">
                          Nueva OV / REF
                          <input
                            type="text"
                            value={ovr.ov_ref}
                            onChange={(e) => setOverride(id, { ov_ref: e.target.value })}
                            placeholder="Opcional"
                            className={`${fieldCls} font-mono mt-1`}
                          />
                        </label>
                        <label className="block text-xs font-medium text-brand-700">
                          Cliente
                          <select
                            value={ovr.cliente}
                            onChange={(e) => setOverride(id, { cliente: e.target.value, cedi: "" })}
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
                        {cedisDelCliente.length > 0 && (
                          <label className="block text-xs font-medium text-brand-700 sm:col-span-2">
                            CEDIS (destino)
                            <select
                              value={ovr.cedi}
                              onChange={(e) => setOverride(id, { cedi: e.target.value })}
                              className={`${fieldCls} bg-white mt-1`}
                            >
                              <option value="">— Selecciona CEDIS —</option>
                              {cedisDelCliente.map((d) => (
                                <option key={d.id} value={d.nombre}>
                                  {d.nombre}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cargas nuevas creadas desde cero para el viaje nuevo */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-brand-700">Cargas nuevas (opcional)</div>
                  <button
                    type="button"
                    onClick={() => setCargasNuevas((prev) => [...prev, emptyOVForm(hoy)])}
                    className="text-xs font-medium text-brand-600 hover:text-brand-900 transition"
                  >
                    + Agregar carga nueva
                  </button>
                </div>
                {cargasNuevas.map((f, i) => (
                  <NuevaCargaCard
                    key={i}
                    form={f}
                    productos={productos}
                    clientes={clientes}
                    lugares={lugares}
                    onChange={(nf) =>
                      setCargasNuevas((prev) => prev.map((x, idx) => (idx === i ? nf : x)))
                    }
                    onRemove={() => setCargasNuevas((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            </>
          )}

          {/* Paso 3 — termógrafos a transferir */}
          {paso === 3 && (
            <>
              <p className="text-sm text-brand-500">
                Elige qué termógrafos pasan al viaje nuevo. Sus lecturas nuevas irán al viaje
                nuevo; el historial anterior se queda en el viaje original.
              </p>
              {termografosActivos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-200 p-6 text-center text-sm text-brand-400">
                  No hay termógrafos disponibles para transferir. Puedes crear el viaje y asignar
                  uno después.
                </div>
              ) : (
                termografosActivos.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-200 px-4 py-3 cursor-pointer hover:bg-brand-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selTermo.has(t.id)}
                      onChange={() => toggle(setSelTermo, t.id)}
                      className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                    />
                    <span className="text-sm font-mono font-medium text-brand-900">{t.id}</span>
                  </label>
                ))
              )}
              {warnSinTermografo && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Vas a mover todos los termógrafos activos, pero el viaje original todavía tiene
                  cargas activas. Esas cargas quedarán <span className="font-semibold">sin
                  monitoreo</span>. Puedes continuar si estás seguro.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer por paso */}
        <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
          {paso === 1 && (
            <>
              <button
                onClick={() => submit(false)}
                disabled={submitting || selOv.size === 0 || rechazables.length === 0}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition shadow-sm"
              >
                {submitting ? "Rechazando…" : "Solo rechazar"}
              </button>
              <button
                onClick={() => setPaso(2)}
                disabled={submitting || selOv.size === 0 || rechazables.length === 0}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition shadow-sm"
              >
                Rechazar y crear viaje →
              </button>
              <button
                onClick={onClose}
                disabled={submitting}
                className="ml-auto rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                Cancelar
              </button>
            </>
          )}
          {paso === 2 && (
            <>
              <button
                onClick={() => setPaso(1)}
                disabled={submitting}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                ← Atrás
              </button>
              <button
                onClick={() => setPaso(3)}
                disabled={submitting}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition shadow-sm"
              >
                Siguiente →
              </button>
            </>
          )}
          {paso === 3 && (
            <>
              <button
                onClick={() => setPaso(2)}
                disabled={submitting}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                ← Atrás
              </button>
              <button
                onClick={() => submit(true)}
                disabled={submitting}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
              >
                {submitting ? "Creando…" : "Crear viaje y rechazar"}
              </button>
            </>
          )}
        </div>
      </div>
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
  role,
}: {
  viaje: Viaje;
  lecturas: LecturaTemperatura[];
  alertas: AlertaLog[];
  termografos: Termografo[];
  auditoria: Auditoria[];
  role: string;
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

  // Modal deshabilitar termógrafo (Cambio 1): se ofrece al completar (ENTREGADO)
  // una carga en un viaje con 2+ termógrafos activos. Deshabilitar es opcional.
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableSel, setDisableSel] = useState<Set<string>>(new Set());
  const [disabling, setDisabling] = useState(false);

  // Modal de rechazo (Cambio 2): la OV sobre la que se eligió "Rechazo".
  const [rechazoOv, setRechazoOv] = useState<OrdenVenta | null>(null);

  // Rango de temperatura del viaje (manual o de catálogo). Si se define, manda
  // sobre los productos de las OVs (Fase 1).
  const [editingRango, setEditingRango] = useState(false);
  const [rangoForm, setRangoForm] = useState({ min: "", max: "" });
  const [savingRango, setSavingRango] = useState(false);
  const [rangosCatalogo, setRangosCatalogo] = useState<RangoTemperatura[]>([]);
  // Paso del modal: null = elegir opción · luego "catalogo" o "manual".
  const [rangoOpcion, setRangoOpcion] = useState<null | "catalogo" | "manual">(null);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  // Rango del catálogo seleccionado pero aún sin confirmar (se aplica con "Aceptar").
  const [rangoSelId, setRangoSelId] = useState<string | null>(null);

  // Modo actual: catálogo (ligado a un rango) · manual · automático (productos)
  const modoRango: "catalogo" | "manual" | "auto" =
    viaje.temp_rango_id != null
      ? "catalogo"
      : viaje.temp_min != null && viaje.temp_max != null
        ? "manual"
        : "auto";

  // Eliminar viaje (solo master/operador)
  const canDelete = role === "master" || role === "operador";
  const [showDeleteViaje, setShowDeleteViaje] = useState(false);
  const [deletingViaje, setDeletingViaje] = useState(false);

  async function handleDeleteViaje() {
    setDeletingViaje(true);
    const res = await fetch(`/api/viajes/${viaje.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Viaje eliminado");
      router.push("/viajes");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Error al eliminar el viaje");
      setDeletingViaje(false);
      setShowDeleteViaje(false);
    }
  }

  // Datos del viaje (unidad) modal
  const [showDatosViaje, setShowDatosViaje] = useState(false);
  const [showAlerta, setShowAlerta] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([]);

  // OV form
  const [showOVForm, setShowOVForm] = useState(false);
  const [editingOVPanel, setEditingOVPanel] = useState<OrdenVenta | null>(null);
  const [detailOV, setDetailOV] = useState<OrdenVenta | null>(null);
  const [detailOVEdit, setDetailOVEdit] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<ClienteConCedis[]>([]);
  const [lugaresOV, setLugaresOV] = useState<{ id: string; nombre: string }[]>([]);
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

  // Rango efectivo: SOLO el rango propio del viaje (manual o catálogo). Los
  // productos ya no tienen temperatura (Fase 4); si no hay rango, queda vacío.
  const hasViajeRange = viaje.temp_min != null && viaje.temp_max != null;
  const tempMin = hasViajeRange ? Number(viaje.temp_min) : null;
  const tempMax = hasViajeRange ? Number(viaje.temp_max) : null;

  // Abre el editor de rango precargando el rango efectivo actual (en °F) y carga
  // el catálogo de rangos (una sola vez) para el selector.
  async function openEditRango() {
    setRangoForm({
      min: tempMin != null ? (cToF(tempMin) as number).toFixed(0) : "",
      max: tempMax != null ? (cToF(tempMax) as number).toFixed(0) : "",
    });
    setRangoOpcion(null);
    setCatalogoOpen(false);
    setRangoSelId(viaje.temp_rango_id ?? null);
    setEditingRango(true);
    if (rangosCatalogo.length === 0) {
      const j = await fetch("/api/rangos").then((r) => r.json()).catch(() => ({}));
      setRangosCatalogo((j.data ?? []) as RangoTemperatura[]);
    }
  }

  // Guarda el rango: manual (rangoId null), de catálogo (rangoId set) o limpia
  // (todo null = vuelve al automático por productos). Todo en °C.
  async function saveRango(minC: number | null, maxC: number | null, rangoId: string | null) {
    setSavingRango(true);
    const res = await fetch(`/api/viajes/${viaje.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_min: minC, temp_max: maxC, temp_rango_id: rangoId }),
    });
    setSavingRango(false);
    if (!res.ok) {
      toast.error("Error al guardar el rango");
      return;
    }
    setViaje((v) => ({ ...v, temp_min: minC, temp_max: maxC, temp_rango_id: rangoId }));
    setEditingRango(false);
    toast.success(minC != null ? "Rango actualizado" : "Rango automático restaurado");
    router.refresh();
  }

  // Manual: escribe min/max en °F → se convierte a °C, sin rango de catálogo.
  function submitRango() {
    const minF = parseFloat(rangoForm.min);
    const maxF = parseFloat(rangoForm.max);
    if (Number.isNaN(minF) || Number.isNaN(maxF)) {
      toast.error("Ingresa mínimo y máximo");
      return;
    }
    if (minF >= maxF) {
      toast.error("El mínimo debe ser menor que el máximo");
      return;
    }
    saveRango(fToC(minF) as number, fToC(maxF) as number, null);
  }

  // Catálogo: copia el min/max del rango elegido al viaje y guarda su id.
  function selectRangoCatalogo(rangoId: string) {
    const r = rangosCatalogo.find((x) => x.id === rangoId);
    if (!r) return;
    saveRango(Number(r.temp_min), Number(r.temp_max), r.id);
  }

  const lecturasByTermografo = useMemo(() => {
    const map = new Map<string, LecturaTemperatura[]>();
    for (const l of lecturas) {
      const list = map.get(l.termografo_id) ?? [];
      list.push(l);
      map.set(l.termografo_id, list);
    }
    return map;
  }, [lecturas]);

  // Termógrafos activos (no deshabilitados): los únicos que cuentan para el
  // promedio y las alertas. Los deshabilitados siguen listados pero congelados.
  const termografosActivos = useMemo(
    () => termografos.filter((t) => !t.deshabilitado),
    [termografos]
  );

  const tempDeCarga = useMemo(() => {
    if (termografosActivos.length === 0) return null;
    const latest = termografosActivos
      .map((t) => {
        const tLecturas = lecturasByTermografo.get(t.id) ?? [];
        return tLecturas[0]?.temperatura != null ? Number(tLecturas[0].temperatura) : null;
      })
      .filter((v): v is number => v !== null);
    if (latest.length === 0) return null;
    return latest.reduce((a, b) => a + b, 0) / latest.length;
  }, [termografosActivos, lecturasByTermografo]);

  // Estado de la temperatura de carga respecto al rango del producto.
  // Mismo criterio de color que la tabla y el gauge (helper único tempEstado):
  //   alta = rojo · baja = azul · ok = neutro
  const tempCargaEstado = tempEstado(tempDeCarga, tempMin, tempMax);
  const tempCargaFuera = tempCargaEstado !== "ok";

  // Monitoreo congelado: todas las OVs entregadas (la temp mostrada es la última, no en vivo).
  // Se calcula desde `ordenes` (estado en vivo) para reflejarse al instante al cambiar status.
  const monitoreoFinalizado = viajeConcluido(ordenes);

  async function loadFormData() {
    const fetches = [];
    if (productos.length === 0)
      fetches.push(
        fetch("/api/productos")
          .then((r) => r.json())
          .then((j) => setProductos(j.data ?? []))
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
    await loadUsuarios();
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
    // Cambio 2: elegir "Rechazo" abre el modal de rechazo en vez de aplicar el
    // cambio. El status solo cambia al confirmar; si se cancela, el dropdown
    // (controlado por ov.status) vuelve solo a su valor.
    if (next === "RECHAZO_CALIDAD") {
      if (ov.status === "ENTREGADO") {
        toast.error("Una carga entregada no se puede rechazar");
        return;
      }
      // Cargar clientes/CEDIS (y demás catálogos) para el editor por carga del modal.
      await loadFormData();
      setRechazoOv(ov);
      return;
    }
    const res = await fetch(`/api/viajes/${viaje.id}/ordenes/${ov.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const nuevasOrdenes = ordenes.map((o) => (o.id === ov.id ? { ...o, status: next } : o));
      setOrdenes(nuevasOrdenes);
      // Cambio 1: al completar (ENTREGADO) una carga en un viaje que aún NO queda
      // concluido y con 2+ termógrafos activos, ofrecer deshabilitar uno o varios.
      if (
        next === "ENTREGADO" &&
        !viajeConcluido(nuevasOrdenes) &&
        termografosActivos.length >= 2
      ) {
        setDisableSel(new Set());
        setShowDisableModal(true);
      }
      // Aplicar de inmediato el congelado/reactivación del monitoreo sin esperar al
      // polling de 3 min: corre un sync y refresca. La suscripción realtime refleja
      // el cambio de alerta_activa al instante.
      fetch(`/api/copeland/sync?viajeId=${viaje.id}`, { method: "POST" })
        .catch(() => void 0)
        .finally(() => router.refresh());
    } else {
      toast.error("Error al actualizar status");
    }
  }

  // Confirmar deshabilitación de los termógrafos seleccionados en el modal.
  async function confirmDisable() {
    const ids = Array.from(disableSel);
    if (ids.length === 0) {
      setShowDisableModal(false);
      return;
    }
    setDisabling(true);
    const results = await Promise.all(
      ids.map((tid) =>
        fetch(`/api/viajes/${viaje.id}/termografos/${encodeURIComponent(tid)}`, {
          method: "PATCH",
        })
          .then((r) => r.ok)
          .catch(() => false)
      )
    );
    setDisabling(false);
    const okIds = ids.filter((_, i) => results[i]);
    if (okIds.length > 0) {
      setTermografos((prev) =>
        prev.map((t) => (okIds.includes(t.id) ? { ...t, deshabilitado: true } : t))
      );
      setActiveTermografoIdx(0);
      toast.success(
        okIds.length === 1
          ? "Termógrafo deshabilitado"
          : `${okIds.length} termógrafos deshabilitados`
      );
    }
    if (okIds.length < ids.length) toast.error("Algún termógrafo no se pudo deshabilitar");
    setShowDisableModal(false);
    router.refresh();
  }

  async function sincronizarViaje() {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      await fetch(`/api/copeland/sync?viajeId=${viaje.id}`, { method: "POST" });
    } catch {
      // best-effort
    } finally {
      setSincronizando(false);
      router.refresh();
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
          setLecturas((prev) => {
            if (prev.some((l) => l.id === row.id)) return prev;
            return [row, ...prev]
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )
              .slice(0, 150);
          });
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      // Solo refresca desde la BD (que el cron mantiene al día) + tiempo real.
      // Ya no llama a Copeland desde el detalle, para no saturar GetSensorReadings.
      router.refresh();
    }, 5 * 60_000);

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

      {/* Modal rango de temperatura */}
      {editingRango && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !savingRango && setEditingRango(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-brand-50">
              <div className="font-display font-bold text-brand-900">Rango de temperatura</div>
            </div>

            <div className="px-6 py-5">
              {/* Paso 1: elegir opción */}
              {rangoOpcion === null && (
                <div className="space-y-3">
                  <p className="text-sm text-brand-500">¿Cómo quieres definir el rango?</p>
                  <button
                    onClick={() => setRangoOpcion("catalogo")}
                    className="w-full text-left rounded-xl border border-brand-200 px-4 py-3 hover:border-brand-400 hover:bg-brand-50 transition"
                  >
                    <div className="text-sm font-semibold text-brand-900">Catálogo de temperaturas</div>
                    <div className="text-xs text-brand-400 mt-0.5">Elige un rango ya dado de alta</div>
                  </button>
                  <button
                    onClick={() => setRangoOpcion("manual")}
                    className="w-full text-left rounded-xl border border-brand-200 px-4 py-3 hover:border-brand-400 hover:bg-brand-50 transition"
                  >
                    <div className="text-sm font-semibold text-brand-900">Temperatura manual</div>
                    <div className="text-xs text-brand-400 mt-0.5">Ingresa el mínimo y máximo a mano</div>
                  </button>
                </div>
              )}

              {/* Paso 2a: catálogo */}
              {rangoOpcion === "catalogo" && (
                <div>
                  <div className="text-xs font-medium text-brand-700 mb-1.5">Catálogo de temperaturas</div>
                  {rangosCatalogo.length > 0 ? (
                    <div className="relative">
                      {/* Botón: muestra solo el rango seleccionado (título) */}
                      <button
                        type="button"
                        onClick={() => setCatalogoOpen((o) => !o)}
                        disabled={savingRango}
                        className={`${fieldCls} bg-white flex items-center justify-between text-left`}
                      >
                        <span className={rangoSelId ? "text-brand-900" : "text-brand-300"}>
                          {(() => {
                            const sel = rangosCatalogo.find((r) => r.id === rangoSelId);
                            return sel
                              ? `${(cToF(sel.temp_min) as number).toFixed(0)}–${(cToF(sel.temp_max) as number).toFixed(0)}°F`
                              : "— Selecciona un rango —";
                          })()}
                        </span>
                        <svg className="w-4 h-4 text-brand-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {/* Lista: cada rango con sus productos en vertical */}
                      {catalogoOpen && (
                        <div className="mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-brand-200 bg-white">
                          {rangosCatalogo.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setRangoSelId(r.id);
                                setCatalogoOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 border-b border-brand-50 last:border-0 hover:bg-brand-50 transition"
                            >
                              <div className="text-sm font-semibold text-brand-900">
                                {(cToF(r.temp_min) as number).toFixed(0)}–{(cToF(r.temp_max) as number).toFixed(0)}°F
                              </div>
                              {(r.productos ?? []).length > 0 && (
                                <div className="mt-0.5 flex flex-col">
                                  {(r.productos ?? []).map((p) => (
                                    <span key={p.id} className="text-xs text-brand-500">
                                      {p.nombre}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-300 italic">
                      No hay rangos en el catálogo. Créalos en Configuración → Temperaturas.
                    </p>
                  )}
                  <p className="text-[11px] text-brand-400 mt-1">
                    Al elegir un rango, el viaje se actualiza si luego editas ese rango en el catálogo.
                  </p>
                </div>
              )}

              {/* Paso 2b: manual */}
              {rangoOpcion === "manual" && (
                <div>
                  <div className="text-xs font-medium text-brand-700 mb-1.5">Temperatura manual</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      autoFocus
                      value={rangoForm.min}
                      onChange={(e) => setRangoForm((f) => ({ ...f, min: e.target.value }))}
                      placeholder="mín"
                      className="w-20 rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <span className="text-brand-400">—</span>
                    <input
                      type="number"
                      value={rangoForm.max}
                      onChange={(e) => setRangoForm((f) => ({ ...f, max: e.target.value }))}
                      placeholder="máx"
                      className="w-20 rounded-lg border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <span className="text-xs text-brand-400">°F</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
              {rangoOpcion === "manual" && (
                <button
                  onClick={submitRango}
                  disabled={savingRango}
                  className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
                >
                  {savingRango ? "Guardando…" : "Guardar"}
                </button>
              )}
              {rangoOpcion === "catalogo" && rangoSelId && (
                <button
                  onClick={() => selectRangoCatalogo(rangoSelId)}
                  disabled={savingRango}
                  className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
                >
                  {savingRango ? "Guardando…" : "Aceptar"}
                </button>
              )}
              {rangoOpcion !== null && (
                <button
                  type="button"
                  onClick={() => setRangoOpcion(null)}
                  className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
                >
                  Atrás
                </button>
              )}
              {!(rangoOpcion === "catalogo" && rangoSelId) && (
                <button
                  type="button"
                  onClick={() => setEditingRango(false)}
                  className="text-sm text-brand-500 hover:text-brand-900 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar viaje */}
      {showDeleteViaje && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !deletingViaje && setShowDeleteViaje(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-brand-50">
              <div className="font-display font-bold text-red-600">
                Eliminar viaje #{String(viaje.numero).padStart(4, "0")}
              </div>
              <p className="text-sm text-brand-500 mt-1">
                Esta acción es permanente y no se puede deshacer.
              </p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-brand-700">Se eliminará de forma definitiva:</p>
              <ul className="text-sm text-brand-700 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="text-red-500">•</span>
                  {ordenes.length} orden{ordenes.length !== 1 ? "es" : ""} de venta (OV)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">•</span>
                  Todo el histórico de temperatura, alertas y modificaciones
                </li>
                {termografos.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">•</span>
                    Se desconectarán {termografos.length} termógrafo
                    {termografos.length !== 1 ? "s" : ""}
                  </li>
                )}
              </ul>
            </div>
            <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
              <button
                onClick={handleDeleteViaje}
                disabled={deletingViaje}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition shadow-sm"
              >
                {deletingViaje ? "Eliminando…" : "Sí, eliminar viaje"}
              </button>
              <button
                onClick={() => setShowDeleteViaje(false)}
                disabled={deletingViaje}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal alerta de temperatura */}
      {showAlerta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowAlerta(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-50">
              <div className="font-display font-bold text-brand-900">Alerta de temperatura</div>
              <button
                type="button"
                onClick={() => setShowAlerta(false)}
                className="text-xs text-brand-400 hover:text-brand-700 transition"
              >
                Cerrar
              </button>
            </div>
            <div className="px-6 py-5">
              <AlertaBanner
                active={tempCargaFuera}
                tempActual={tempDeCarga}
                tempMin={tempMin}
                tempMax={tempMax}
              />
            </div>
          </div>
        </div>
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

      {/* Modal deshabilitar termógrafo (Cambio 1) */}
      {showDisableModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !disabling && setShowDisableModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-brand-50">
              <div className="font-display font-bold text-brand-900">Deshabilitar termógrafo</div>
              <p className="text-sm text-brand-500 mt-1">
                Carga completada. Este viaje tiene varios termógrafos activos: puedes
                deshabilitar los que ya no viajan con la carga. Es opcional.
              </p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="text-xs font-medium text-brand-700">Termógrafos activos</div>
              {termografosActivos.map((t) => {
                const checked = disableSel.has(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-200 px-4 py-3 cursor-pointer hover:bg-brand-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setDisableSel((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.add(t.id);
                          else n.delete(t.id);
                          return n;
                        })
                      }
                      className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                    />
                    <span className="text-sm font-mono font-medium text-brand-900">{t.id}</span>
                  </label>
                );
              })}
              {disableSel.size > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
                  <div className="font-semibold">
                    Al deshabilitar {disableSel.size === 1 ? "este termógrafo" : "estos termógrafos"}:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Dejará de usarse para lecturas nuevas y alertas.</li>
                    <li>La temperatura del viaje se calculará solo con los termógrafos restantes.</li>
                    <li>Si queda un solo termógrafo activo, se mostrará su lectura directa (sin promedio).</li>
                    <li>Su historial se conserva. La acción no se puede revertir desde AgroTrack.</li>
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 pb-5 pt-2 border-t border-brand-50">
              <button
                onClick={confirmDisable}
                disabled={disabling}
                className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
              >
                {disabling
                  ? "Guardando…"
                  : disableSel.size === 0
                    ? "No deshabilitar"
                    : "Deshabilitar"}
              </button>
              <button
                onClick={() => setShowDisableModal(false)}
                disabled={disabling}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de rechazo (Cambio 2) */}
      {rechazoOv && (
        <RechazoModal
          viaje={viaje}
          ordenes={ordenes}
          clientes={clientes}
          productos={productos}
          lugares={lugaresOV}
          termografosActivos={termografosActivos}
          initialOvId={rechazoOv.id}
          onClose={() => setRechazoOv(null)}
          onDone={({ rechazadas, nuevo_viaje }) => {
            setRechazoOv(null);
            if (nuevo_viaje) {
              toast.success(`Viaje #${String(nuevo_viaje.numero).padStart(4, "0")} creado`);
              router.push(`/viajes/${nuevo_viaje.id}`);
              router.refresh();
            } else {
              setOrdenes((prev) =>
                prev.map((o) =>
                  rechazadas.includes(o.id) ? { ...o, status: "RECHAZO_CALIDAD" as Status } : o
                )
              );
              toast.success(
                rechazadas.length === 1 ? "Carga rechazada" : `${rechazadas.length} cargas rechazadas`
              );
              router.refresh();
            }
          }}
        />
      )}

      {/* Modal detalle OV */}
      {detailOV && (
        <OVDetailModal
          ov={detailOV}
          viaje_id={viaje.id}
          productos={productos}
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-brand-400 mb-1">
            Viaje #{String(viaje.numero).padStart(4, "0")}
          </div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-brand-900 tracking-tight break-words">
            {viaje.lugar_inicio}
            <span className="text-brand-300 mx-2.5">→</span>
            {viaje.lugar_fin}
          </h1>
          <div className="mt-1 text-sm text-brand-500">
            {formatFecha(viaje.fecha_inicio)} — {formatFecha(viaje.fecha_fin)}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
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
            <div className="flex gap-2">
              <button
                onClick={startEditViaje}
                className="rounded-xl border border-brand-200 px-5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
              >
                Editar viaje
              </button>
              {canDelete && (
                <button
                  onClick={() => setShowDeleteViaje(true)}
                  className="rounded-xl border border-red-200 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
                >
                  Eliminar viaje
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
                {/* Móvil (<sm): tarjetas con toda la info */}
                <div className="sm:hidden divide-y divide-brand-50">
                  {ordenes.map((ov) => (
                    <div
                      key={ov.id}
                      onClick={() => openOVDetail(ov)}
                      className="px-4 py-3 space-y-1.5 active:bg-brand-50/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                          {ov.ov_ref}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
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
                        </div>
                      </div>
                      <div className="font-medium text-brand-900 text-sm">{ov.cliente}</div>
                      <div className="text-xs text-brand-600">
                        <span className="text-brand-400">Carga: </span>
                        {formatFecha(ov.fecha_carga)} · {ov.lugar_carga}
                      </div>
                      <div className="text-xs text-brand-600">
                        <span className="text-brand-400">Cita: </span>
                        {ov.tiene_cita && ov.fecha_entrega
                          ? `${formatFecha(ov.fecha_entrega)}${ov.cita ? ` · ${to12h(ov.cita)}` : ""}`
                          : "—"}
                        {ov.cedi ? ` · ${ov.cedi}` : ""}
                      </div>
                      <div className="text-xs text-brand-500">
                        <span className="text-brand-400">Producto: </span>
                        {(ov.productos ?? []).length > 0
                          ? (ov.productos ?? []).map((p) => p.producto?.nombre ?? "—").join(", ")
                          : "—"}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* sm+: tabla */}
                <div className="hidden sm:block overflow-x-auto">
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
                            <div>{formatFecha(ov.fecha_carga)}</div>
                            <div className="text-brand-400">{ov.lugar_carga}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">
                            {ov.tiene_cita && ov.fecha_entrega ? (
                              <div>
                                {formatFecha(ov.fecha_entrega)}
                                {ov.cita ? ` · ${to12h(ov.cita)}` : ""}
                              </div>
                            ) : (
                              <div className="text-brand-300">—</div>
                            )}
                            {ov.cedi && <div className="text-brand-400">{ov.cedi}</div>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-brand-500">
                            {(ov.productos ?? []).length > 0
                              ? (ov.productos ?? []).map((p) => p.producto?.nombre ?? "—").join(", ")
                              : "—"}
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
                placeholder=""
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
                placeholder=""
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
              <DatePicker
                required
                value={viajeEdit.fecha_inicio}
                onChange={(v) => setViajeEdit((prev) => ({ ...prev, fecha_inicio: v }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Fecha de inicio" value={formatFecha(viaje.fecha_inicio)} />
          )}

          {editingViaje ? (
            <EditCell label="Fecha de fin">
              <DatePicker
                required
                value={viajeEdit.fecha_fin}
                onChange={(v) => setViajeEdit((prev) => ({ ...prev, fecha_fin: v }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Fecha de fin" value={formatFecha(viaje.fecha_fin)} />
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
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium font-mono text-brand-900">{t.id}</span>
                    {t.deshabilitado && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-brand-500 bg-brand-100 rounded-full px-2 py-0.5 shrink-0">
                        Deshabilitado
                      </span>
                    )}
                  </span>
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
                ? formatFechaHora(viaje.ultima_lectura)
                : "—"
            }
          />

          {/* Temperatura de carga */}
          {termografos.length > 0 && (
            <div className="relative rounded-xl border border-brand-100 bg-white px-4 py-3 flex flex-col items-center justify-center text-center">
              <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">
                Temperatura de carga
              </div>
              <div
                className={`text-2xl font-bold ${
                  tempCargaEstado === "alta"
                    ? "text-red-700"
                    : tempCargaEstado === "baja"
                      ? "text-blue-700"
                      : "text-brand-900"
                }`}
              >
                {tempDeCarga != null ? `${(cToF(tempDeCarga) as number).toFixed(1)}°F` : "—"}
              </div>
              {termografosActivos.length > 1 && (
                <div className="text-[11px] text-brand-400 mt-1">
                  Promedio de {termografosActivos.length} termógrafos
                </div>
              )}
              {monitoreoFinalizado && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                  Monitoreo finalizado
                </div>
              )}
              {tempCargaFuera && (
                <button
                  type="button"
                  onClick={() => setShowAlerta(true)}
                  className="absolute bottom-2 right-3 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
                >
                  Ver más
                </button>
              )}
            </div>
          )}

          {/* Rango de temperatura del viaje */}
          <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">
              Rango de temperatura
            </div>
            <div className="text-sm font-medium text-brand-900">
              {tempMin != null && tempMax != null
                ? `${(cToF(tempMin) as number).toFixed(0)} — ${(cToF(tempMax) as number).toFixed(0)}°F`
                : "—"}
            </div>
            <div className="flex items-end justify-between gap-2 mt-0.5">
              <div className="text-[11px] text-brand-400">
                {modoRango === "catalogo"
                  ? "Catálogo de temperaturas"
                  : modoRango === "manual"
                    ? "Manual (definido en el viaje)"
                    : "Sin rango asignado"}
              </div>
              <button
                onClick={openEditRango}
                className="text-xs text-brand-500 hover:text-brand-900 transition shrink-0"
              >
                Editar
              </button>
            </div>
          </div>
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
                            {t.deshabilitado && (
                              <div className="text-center text-[11px] font-medium uppercase tracking-wide text-brand-500">
                                Termógrafo deshabilitado · historial
                              </div>
                            )}
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
            <div className="px-5 py-3 border-b border-brand-50 flex items-center justify-between">
              <span className="font-display font-semibold text-sm text-brand-900 uppercase tracking-widest">
                Últimas lecturas
              </span>
              <button
                type="button"
                onClick={sincronizarViaje}
                disabled={sincronizando}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-3.5 h-3.5 ${sincronizando ? "animate-spin" : ""}`}
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
                </svg>
                {sincronizando ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
            {lecturas.length === 0 ? (
              <div className="p-6 text-sm text-brand-400 text-center">Sin lecturas aún.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-brand-50 text-xs uppercase text-brand-400 tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2">Hora</th>
                    <th className="text-left px-4 py-2">Temp</th>
                    {termografos.length > 1 && (
                      <th className="text-left px-4 py-2">Termógrafo</th>
                    )}
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
                      {termografos.length > 1 && (
                        <td className="px-4 py-2 text-xs font-mono text-brand-500">
                          {l.termografo_id}
                        </td>
                      )}
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
                {alertas.slice(0, 6).map((a) => (
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
                        {formatFechaHora(a.created_at)} · {a.enviado_a}
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
