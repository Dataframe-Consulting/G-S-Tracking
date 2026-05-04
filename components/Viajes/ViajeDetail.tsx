"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type {
  AlertaLog,
  LecturaTemperatura,
  OrdenVenta,
  Producto,
  ProductoCombinacion,
  Responsable,
  Status,
  Transportista,
  Viaje,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";
import { StatusBadge } from "@/components/Cargas/StatusBadge";
import { TempGauge } from "@/components/Temperatura/TempGauge";
import { TempChart } from "@/components/Temperatura/TempChart";
import { AlertaBanner } from "@/components/Alertas/AlertaBanner";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const MapaTracker = dynamic(() => import("@/components/Mapa/MapaTracker"), { ssr: false });

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
        {children}
      </span>
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
  fecha_carga: string;
  lugar_carga: string;
  fecha_entrega: string;
  lugar_entrega: string;
  cita: string;
  status: Status;
  instrucciones: string;
  producto_sel: string;
  cajas: string;
  cajas_b: string;
};

const emptyOVForm = (today: string): OVFormData => ({
  ov_ref: "",
  cliente: "",
  fecha_carga: today,
  lugar_carga: "",
  fecha_entrega: today,
  lugar_entrega: "",
  cita: "",
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
  onSaved,
  onCancel,
}: {
  viaje_id: string;
  editingOV: OrdenVenta | null;
  productos: Producto[];
  combinaciones: ProductoCombinacion[];
  clientes: { id: string; nombre: string }[];
  onSaved: (ov: OrdenVenta) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<OVFormData>(() =>
    editingOV
      ? {
          ov_ref: editingOV.ov_ref,
          cliente: editingOV.cliente,
          fecha_carga: editingOV.fecha_carga,
          lugar_carga: editingOV.lugar_carga,
          fecha_entrega: editingOV.fecha_entrega,
          lugar_entrega: editingOV.lugar_entrega,
          cita: editingOV.cita ?? "",
          status: editingOV.status,
          instrucciones: editingOV.instrucciones,
          producto_sel: productoSelFromOV(editingOV),
          cajas: editingOV.cajas != null ? String(editingOV.cajas) : "",
          cajas_b: editingOV.cajas_b != null ? String(editingOV.cajas_b) : "",
        }
      : emptyOVForm(today)
  );
  const [saving, setSaving] = useState(false);

  function upd<K extends keyof OVFormData>(key: K, val: OVFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const isCombo = form.producto_sel.startsWith("combo:");
  const isProd = form.producto_sel.startsWith("prod:");
  const selectedCombo = isCombo
    ? combinaciones.find((c) => c.id === form.producto_sel.slice(6))
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.producto_sel) {
      toast.error("Selecciona un producto");
      return;
    }
    setSaving(true);
    const { producto_id, producto_combinacion_id } = parseProductoSel(form.producto_sel);
    const body = {
      ov_ref: form.ov_ref,
      cliente: form.cliente,
      fecha_carga: form.fecha_carga,
      lugar_carga: form.lugar_carga,
      fecha_entrega: form.fecha_entrega,
      lugar_entrega: form.lugar_entrega,
      cita: form.cita || null,
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
        {editingOV ? "Editar OV" : "Nueva OV"}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="block text-xs font-medium text-brand-700">
          OV / REF *
          <input
            type="text"
            required
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
            onChange={(e) => upd("cliente", e.target.value)}
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
        <label className="block text-xs font-medium text-brand-700">
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
        <label className="block text-xs font-medium text-brand-700">
          Cita
          <input
            type="text"
            placeholder="6AM"
            value={form.cita}
            onChange={(e) => upd("cita", e.target.value)}
            className={`${fieldCls} mt-1`}
          />
        </label>

        <label className="block text-xs font-medium text-brand-700">
          Fecha de entrega *
          <input
            type="date"
            required
            value={form.fecha_entrega}
            onChange={(e) => upd("fecha_entrega", e.target.value)}
            className={`${fieldCls} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-brand-700">
          Lugar de entrega *
          <input
            type="text"
            required
            placeholder="Nogales"
            value={form.lugar_entrega}
            onChange={(e) => upd("lugar_entrega", e.target.value)}
            className={`${fieldCls} mt-1`}
          />
        </label>

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
                    {p.nombre} ({p.temp_min}° — {p.temp_max}°C)
                  </option>
                ))}
              </optgroup>
            )}
            {combinaciones.length > 0 && (
              <optgroup label="── Combinados">
                {combinaciones.map((c) => (
                  <option key={c.id} value={`combo:${c.id}`}>
                    {c.producto_a.nombre} + {c.producto_b.nombre} ({c.temp_min}° — {c.temp_max}°C)
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
          Instrucciones *
          <textarea
            required
            rows={2}
            value={form.instrucciones}
            onChange={(e) => upd("instrucciones", e.target.value)}
            placeholder="768 CAJAS AGUACATE CONVENCIONAL / 420 CAJAS AGUACATE ORGÁNICO"
            className={`${fieldCls} mt-1 resize-none`}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
        >
          {saving ? "Guardando…" : editingOV ? "Guardar cambios" : "Agregar OV"}
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
  clientes: { id: string; nombre: string }[];
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
    fecha_carga: initialOv.fecha_carga,
    lugar_carga: initialOv.lugar_carga,
    fecha_entrega: initialOv.fecha_entrega,
    lugar_entrega: initialOv.lugar_entrega,
    cita: initialOv.cita ?? "",
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
      fecha_carga: ov.fecha_carga,
      lugar_carga: ov.lugar_carga,
      fecha_entrega: ov.fecha_entrega,
      lugar_entrega: ov.lugar_entrega,
      cita: ov.cita ?? "",
      status: ov.status,
      instrucciones: ov.instrucciones,
      producto_sel: productoSelFromOV(ov),
      cajas: ov.cajas != null ? String(ov.cajas) : "",
      cajas_b: ov.cajas_b != null ? String(ov.cajas_b) : "",
    });
    setIsEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.producto_sel) { toast.error("Selecciona un producto"); return; }
    setSaving(true);
    const { producto_id, producto_combinacion_id } = parseProductoSel(form.producto_sel);
    const body = {
      ov_ref: form.ov_ref,
      cliente: form.cliente,
      fecha_carga: form.fecha_carga,
      lugar_carga: form.lugar_carga,
      fecha_entrega: form.fecha_entrega,
      lugar_entrega: form.lugar_entrega,
      cita: form.cita || null,
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
                Editar OV
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
                  OV / REF *
                  <input
                    type="text"
                    required
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

              {/* Cliente */}
              <label className="block text-xs font-medium text-brand-700">
                Cliente *
                <select
                  required
                  value={form.cliente}
                  onChange={(e) => upd("cliente", e.target.value)}
                  className={`${fieldCls} bg-white mt-1`}
                >
                  <option value="">— Selecciona cliente —</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </label>

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

              {/* Entrega */}
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="block text-xs font-medium text-brand-700">
                  Fecha entrega *
                  <input
                    type="date"
                    required
                    value={form.fecha_entrega}
                    onChange={(e) => upd("fecha_entrega", e.target.value)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
                <label className="block text-xs font-medium text-brand-700 sm:col-span-2">
                  Lugar de entrega *
                  <input
                    type="text"
                    required
                    placeholder="Nogales"
                    value={form.lugar_entrega}
                    onChange={(e) => upd("lugar_entrega", e.target.value)}
                    className={`${fieldCls} mt-1`}
                  />
                </label>
              </div>

              {/* Cita */}
              <label className="block text-xs font-medium text-brand-700 max-w-[10rem]">
                Cita
                <input
                  type="text"
                  placeholder="6AM"
                  value={form.cita}
                  onChange={(e) => upd("cita", e.target.value)}
                  className={`${fieldCls} mt-1`}
                />
              </label>

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
                            {p.nombre} ({p.temp_min}° — {p.temp_max}°C)
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {combinaciones.length > 0 && (
                      <optgroup label="── Combinados">
                        {combinaciones.map((c) => (
                          <option key={c.id} value={`combo:${c.id}`}>
                            {c.producto_a.nombre} + {c.producto_b.nombre} ({c.temp_min}° — {c.temp_max}°C)
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
                Instrucciones *
                <textarea
                  required
                  rows={3}
                  value={form.instrucciones}
                  onChange={(e) => upd("instrucciones", e.target.value)}
                  placeholder="768 CAJAS AGUACATE CONVENCIONAL"
                  className={`${fieldCls} mt-1 resize-none`}
                />
              </label>
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
              </div>

              {/* Carga / Entrega */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Carga</div>
                  <div className="text-sm font-medium text-brand-900">{ov.fecha_carga}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{ov.lugar_carga}</div>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">
                    Entrega{ov.cita ? ` · Cita: ${ov.cita}` : ""}
                  </div>
                  <div className="text-sm font-medium text-brand-900">{ov.fecha_entrega}</div>
                  <div className="text-xs text-brand-500 mt-0.5">{ov.lugar_entrega}</div>
                </div>
              </div>

              {/* Producto */}
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">Producto</div>
                {ov.producto ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-brand-900">{ov.producto.nombre}</div>
                      <div className="text-xs text-brand-500">{ov.producto.temp_min}° — {ov.producto.temp_max}°C</div>
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
                    <div className="text-xs text-brand-500 mb-2">{combo.temp_min}° — {combo.temp_max}°C</div>
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
                <p className="text-sm text-brand-700 whitespace-pre-wrap leading-relaxed">{ov.instrucciones}</p>
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
  onAssigned,
}: {
  viajeId: string;
  onClose: () => void;
  onAssigned: (id: string) => void;
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
      onAssigned(id);
    } else {
      const json = await res.json();
      toast.error(json.error || "Error al conectar");
    }
  }

  return (
    <>
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
    </>
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
}: {
  viaje: Viaje;
  lecturas: LecturaTemperatura[];
  alertas: AlertaLog[];
}) {
  const router = useRouter();
  const [viaje, setViaje] = useState(initialViaje);
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>(initialViaje.ordenes_venta ?? []);
  const [lecturas, setLecturas] = useState(initialLecturas);
  const [syncing, setSyncing] = useState(false);

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

  // OV form
  const [showOVForm, setShowOVForm] = useState(false);
  const [detailOV, setDetailOV] = useState<OrdenVenta | null>(null);
  const [detailOVEdit, setDetailOVEdit] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [combinaciones, setCombinaciones] = useState<ProductoCombinacion[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
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

  const tempRanges = ordenes.map((o) => o.producto).filter(Boolean) as Producto[];
  const tempMin =
    tempRanges.length > 0 ? Math.max(...tempRanges.map((p) => Number(p.temp_min))) : null;
  const tempMax =
    tempRanges.length > 0 ? Math.min(...tempRanges.map((p) => Number(p.temp_max))) : null;

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
    await Promise.all(fetches);
  }

  async function loadTransportistas() {
    if (transportistas.length === 0) {
      const j = await fetch("/api/transportistas").then((r) => r.json());
      setTransportistas(j.data ?? []);
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

  async function doSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/copeland/sync?viajeId=${viaje.id}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Sincronización completada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
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

  const showOVFormPanel = showOVForm;

  return (
    <div className="space-y-6">

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
              onAssigned={(id) => {
                setViaje((prev) => ({ ...prev, termografo_id: id }));
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
          <h1 className="font-display font-extrabold text-3xl text-brand-900 tracking-tight">
            {viaje.lugar_inicio}
            <span className="text-brand-400 mx-3">→</span>
            {viaje.lugar_fin}
          </h1>
          <div className="mt-1 text-sm text-brand-500">
            {viaje.fecha_inicio} — {viaje.fecha_fin}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={doSync}
            disabled={syncing || !viaje.termografo_id}
            className="rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition shadow-sm"
          >
            {syncing ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
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

      {/* Datos del viaje */}
      <div>
        <SectionHeader>Datos del viaje</SectionHeader>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {editingViaje ? (
            <EditCell label="Lugar de inicio">
              <input
                type="text"
                value={viajeEdit.lugar_inicio}
                onChange={(e) => setViajeEdit((v) => ({ ...v, lugar_inicio: e.target.value }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Lugar de inicio" value={viaje.lugar_inicio} />
          )}

          {editingViaje ? (
            <EditCell label="Lugar de fin">
              <input
                type="text"
                value={viajeEdit.lugar_fin}
                onChange={(e) => setViajeEdit((v) => ({ ...v, lugar_fin: e.target.value }))}
                className={bareInput}
              />
            </EditCell>
          ) : (
            <InfoCell label="Lugar de fin" value={viaje.lugar_fin} />
          )}

          {editingViaje ? (
            <EditCell label="Flete">
              <select
                value={viajeEdit.flete_cargo}
                onChange={(e) => setViajeEdit((v) => ({ ...v, flete_cargo: e.target.value }))}
                className={bareSelect}
              >
                <option value="">— Sin transportista —</option>
                {transportistas.map((t) => (
                  <option key={t.id} value={t.nombre}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </EditCell>
          ) : (
            <InfoCell label="Flete" value={viaje.flete_cargo ?? "—"} />
          )}

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
                    {u.nombre ? `${u.nombre} (${u.email})` : u.email}
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
                    {viaje.responsable.nombre && (
                      <div className="text-xs text-brand-400 truncate">
                        {viaje.responsable.email}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-brand-300">—</div>
              )}
            </div>
          )}

          {/* Termógrafo */}
          <div className="rounded-xl border border-brand-100 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-1">
              Termógrafo
            </div>
            {viaje.termografo_id ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium font-mono text-brand-900">
                  {viaje.termografo_id}
                </span>
                <button
                  onClick={() => setShowTermografoModal(true)}
                  className="text-xs text-brand-500 hover:text-brand-900 transition"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTermografoModal(true)}
                className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:border-brand-400 transition w-full text-left"
              >
                + Agregar termógrafo
              </button>
            )}
          </div>

          <InfoCell
            label="Última lectura"
            value={
              viaje.ultima_lectura
                ? new Date(viaje.ultima_lectura).toLocaleString("es-MX")
                : "—"
            }
          />
        </div>
      </div>

      {/* Monitoreo */}
      <div>
        <SectionHeader>Monitoreo</SectionHeader>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-brand-100 bg-white overflow-hidden h-96 shadow-sm">
            <MapaTracker
              position={position}
              path={path}
              outOfRange={!!viaje.alerta_activa}
              title={`Viaje #${String(viaje.numero).padStart(4, "0")}`}
            />
          </div>
          <div className="space-y-3">
            {tempMin != null && tempMax != null ? (
              <>
                <TempGauge
                  value={viaje.temp_actual != null ? Number(viaje.temp_actual) : null}
                  min={tempMin}
                  max={tempMax}
                />
                <TempChart lecturas={lecturas} min={tempMin} max={tempMax} />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-200 p-8 text-sm text-brand-500 bg-white text-center">
                <div className="text-3xl mb-2">🌡️</div>
                Agrega una OV con producto para habilitar el monitoreo de temperatura.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Órdenes de Venta */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
            Órdenes de Venta
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
              + Agregar OV
            </button>
          )}
        </div>

        <div className="space-y-3">
          {showOVFormPanel && (
            <OVFormPanel
              viaje_id={viaje.id}
              editingOV={null}
              productos={productos}
              combinaciones={combinaciones}
              clientes={clientes}
              onSaved={handleOVSaved}
              onCancel={() => setShowOVForm(false)}
            />
          )}

          {ordenes.length === 0 && !showOVFormPanel ? (
            <div className="rounded-2xl border border-dashed border-brand-200 p-8 text-center bg-white">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm text-brand-500">
                Sin órdenes de venta aún. Agrega la primera OV.
              </div>
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
                          Entrega
                        </th>
                        <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                          Producto
                        </th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
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
                          <td className="px-4 py-3 font-medium text-brand-900">{ov.cliente}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">
                            <div>{ov.fecha_carga}</div>
                            <div className="text-brand-400">{ov.lugar_carga}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-brand-600 text-xs">
                            <div>
                              {ov.fecha_entrega}
                              {ov.cita ? ` · ${ov.cita}` : ""}
                            </div>
                            <div className="text-brand-400">{ov.lugar_entrega}</div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-brand-500">
                            {ov.producto?.nombre ?? "—"}
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
                              onClick={() => openOVDetail(ov, true)}
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
                        {Number(l.temperatura).toFixed(1)}°C
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-brand-400 hidden sm:table-cell">
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
                      <div className="font-medium text-brand-900">
                        {a.tipo === "TEMP_ALTA" ? "🔴 Temp ALTA" : "🔵 Temp BAJA"}
                        {a.temperatura != null && (
                          <span className="ml-2 text-brand-500">
                            {Number(a.temperatura).toFixed(1)}°C
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
    </div>
  );
}
