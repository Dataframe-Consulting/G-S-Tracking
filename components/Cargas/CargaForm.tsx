"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { STATUS_LABELS, STATUS_VALUES, type Producto, type Status } from "@/lib/types";

const LUGAR_OPTIONS = ["FRIGO", "BODEGA", "CAMPO", "OTRO"];

export function CargaForm({
  productos
}: {
  productos: Producto[];
}) {
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    fecha_carga: today,
    fecha_entrega: today,
    cita: "",
    cliente: "",
    ov_ref: "",
    lugar_carga: "FRIGO",
    producto_descripcion: "",
    producto_id: "",
    status: "PENDIENTE" as Status,
    flete_cargo: ""
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/cargas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        producto_id: form.producto_id || null,
        cita: form.cita || null,
        flete_cargo: form.flete_cargo || null
      })
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error al crear");
      return;
    }
    toast.success("Carga creada");
    router.push(`/cargas/${json.data.id}`);
    router.refresh();
  }

  const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  const label = "block text-sm";

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className={label}>
          <span className="font-medium text-slate-700">Fecha de carga</span>
          <input
            type="date"
            required
            value={form.fecha_carga}
            onChange={(e) => update("fecha_carga", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Fecha de entrega</span>
          <input
            type="date"
            required
            value={form.fecha_entrega}
            onChange={(e) => update("fecha_entrega", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Cita</span>
          <input
            type="text"
            placeholder="6AM"
            value={form.cita}
            onChange={(e) => update("cita", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Cliente</span>
          <input
            type="text"
            required
            value={form.cliente}
            onChange={(e) => update("cliente", e.target.value)}
            className={field}
          />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">OV / REF</span>
          <input
            type="text"
            required
            value={form.ov_ref}
            onChange={(e) => update("ov_ref", e.target.value)}
            className={`${field} font-mono`}
          />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Lugar de carga</span>
          <select
            value={form.lugar_carga}
            onChange={(e) => update("lugar_carga", e.target.value)}
            className={`${field} bg-white`}
          >
            {LUGAR_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={label}>
        <span className="font-medium text-slate-700">Descripción del producto</span>
        <textarea
          required
          rows={3}
          value={form.producto_descripcion}
          onChange={(e) => update("producto_descripcion", e.target.value)}
          placeholder="768 CAJAS AGUACATE CONVENCIONAL / 420 CAJAS AGUACATE ORGÁNICO"
          className={field}
        />
        <span className="text-xs text-slate-500 block mt-1">
          Texto libre — tal y como aparece en el Excel.
        </span>
      </label>

      <div className="grid md:grid-cols-2 gap-4">
        <label className={label}>
          <span className="font-medium text-slate-700">Producto (rango de temperatura)</span>
          <select
            value={form.producto_id}
            onChange={(e) => update("producto_id", e.target.value)}
            className={`${field} bg-white`}
          >
            <option value="">— Sin producto —</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.temp_min}° — {p.temp_max}°)
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          <span className="font-medium text-slate-700">Status</span>
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value as Status)}
            className={`${field} bg-white`}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className={label}>
          <span className="font-medium text-slate-700">Flete a cargo</span>
          <input
            type="text"
            value={form.flete_cargo}
            onChange={(e) => update("flete_cargo", e.target.value)}
            className={field}
          />
        </label>

      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Crear carga"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
