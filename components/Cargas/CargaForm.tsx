"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { type Producto, type Cliente, type Transportista, type ProductoCombinacion } from "@/lib/types";

const LUGAR_OPTIONS = ["FRIGO", "BODEGA", "CAMPO", "OTRO"];

const field =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
        {children}
      </span>
      <div className="flex-1 h-px bg-brand-100" />
    </div>
  );
}

// Value encoding: "prod:{id}" | "combo:{id}" | ""
function parseProductoSel(sel: string): { producto_id: string | null; producto_combinacion_id: string | null } {
  if (sel.startsWith("prod:"))  return { producto_id: sel.slice(5), producto_combinacion_id: null };
  if (sel.startsWith("combo:")) return { producto_id: null, producto_combinacion_id: sel.slice(6) };
  return { producto_id: null, producto_combinacion_id: null };
}

export function CargaForm({
  productos,
  clientes,
  transportistas,
  combinaciones,
}: {
  productos: Producto[];
  clientes: Cliente[];
  transportistas: Transportista[];
  combinaciones: ProductoCombinacion[];
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
    producto_sel: "",   // "prod:{id}" | "combo:{id}" | ""
    flete_cargo: "",
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { producto_id, producto_combinacion_id } = parseProductoSel(form.producto_sel);
    const res = await fetch("/api/cargas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fecha_carga: form.fecha_carga,
        fecha_entrega: form.fecha_entrega,
        cita: form.cita || null,
        cliente: form.cliente,
        ov_ref: form.ov_ref,
        lugar_carga: form.lugar_carga,
        producto_descripcion: form.producto_descripcion,
        producto_id,
        producto_combinacion_id,
        status: "PENDIENTE",
        flete_cargo: form.flete_cargo || null,
      }),
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

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 space-y-5">

      <SectionTitle>Fechas y cliente</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="block text-sm font-medium text-brand-700">
          Fecha de carga
          <input type="date" required value={form.fecha_carga}
            onChange={(e) => update("fecha_carga", e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Fecha de entrega
          <input type="date" required value={form.fecha_entrega}
            onChange={(e) => update("fecha_entrega", e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Cita
          <input type="text" placeholder="6AM" value={form.cita}
            onChange={(e) => update("cita", e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Lugar de carga
          <select value={form.lugar_carga} onChange={(e) => update("lugar_carga", e.target.value)}
            className={`${field} bg-white`}>
            {LUGAR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-brand-700 lg:col-span-2">
          Cliente
          <select required value={form.cliente} onChange={(e) => update("cliente", e.target.value)}
            className={`${field} bg-white`}>
            <option value="">— Selecciona cliente —</option>
            {clientes.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-brand-700">
          OV / REF
          <input type="text" required value={form.ov_ref}
            onChange={(e) => update("ov_ref", e.target.value)} className={`${field} font-mono`} />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Flete a cargo
          <select value={form.flete_cargo} onChange={(e) => update("flete_cargo", e.target.value)}
            className={`${field} bg-white`}>
            <option value="">— Sin transportista —</option>
            {transportistas.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </label>
      </div>

      <SectionTitle>Producto</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="block text-sm font-medium text-brand-700">
          Producto (rango de temperatura)
          <select value={form.producto_sel} onChange={(e) => update("producto_sel", e.target.value)}
            className={`${field} bg-white`}>
            <option value="">— Sin producto —</option>
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
        <label className="block text-sm font-medium text-brand-700 lg:col-span-3">
          Descripción del producto
          <textarea required rows={2} value={form.producto_descripcion}
            onChange={(e) => update("producto_descripcion", e.target.value)}
            placeholder="768 CAJAS AGUACATE CONVENCIONAL / 420 CAJAS AGUACATE ORGÁNICO"
            className={field} />
          <span className="text-xs text-brand-400 mt-1 block">
            Texto libre — tal y como aparece en el Excel.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-brand-100">
        <button type="submit" disabled={saving}
          className="rounded-xl bg-brand-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm">
          {saving ? "Guardando…" : "Crear carga"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="rounded-xl border border-brand-200 px-6 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition">
          Cancelar
        </button>
      </div>
    </form>
  );
}
