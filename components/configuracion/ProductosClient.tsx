"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Producto } from "@/lib/types";

export interface Combinacion {
  id: string;
  producto_a_id: string;
  producto_b_id: string;
  temp_min: number;
  temp_max: number;
  producto_a: { id: string; nombre: string };
  producto_b: { id: string; nombre: string };
}

const inp =
  "rounded-xl border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

const tabBase =
  "px-4 py-1.5 text-sm font-semibold rounded-lg transition";
const tabActive = "bg-brand-900 text-white";
const tabInactive = "text-brand-600 hover:bg-brand-50";

// ─── Individuales ────────────────────────────────────────────────────────────

function IndividualesView({ initialProductos }: { initialProductos: Producto[] }) {
  const [productos, setProductos] = useState<Producto[]>(initialProductos);
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState({ nombre: "", temp_min: "", temp_max: "" });
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editForm, setEditForm]   = useState({ temp_min: "", temp_max: "" });
  const [deleting, setDeleting]   = useState<string | null>(null);

  async function add() {
    if (!addForm.nombre.trim()) { toast.error("Nombre requerido"); return; }
    if (!addForm.temp_min || !addForm.temp_max) { toast.error("Temperaturas requeridas"); return; }
    if (Number(addForm.temp_min) >= Number(addForm.temp_max)) { toast.error("Temp mínima debe ser menor a la máxima"); return; }
    setSaving(true);
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: addForm.nombre.trim(), temp_min: Number(addForm.temp_min), temp_max: Number(addForm.temp_max) }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Producto agregado");
    setProductos((p) => [...p, json.data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setAddForm({ nombre: "", temp_min: "", temp_max: "" });
    setAddOpen(false);
  }

  function startEdit(p: Producto) {
    setEditId(p.id);
    setEditForm({ temp_min: String(p.temp_min), temp_max: String(p.temp_max) });
  }

  async function saveEdit(id: string) {
    if (Number(editForm.temp_min) >= Number(editForm.temp_max)) { toast.error("Temp mínima debe ser menor a la máxima"); return; }
    const res = await fetch(`/api/productos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_min: Number(editForm.temp_min), temp_max: Number(editForm.temp_max) }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Actualizado");
    setProductos((p) => p.map((x) => (x.id === id ? (json.data as Producto) : x)));
    setEditId(null);
  }

  async function remove(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Eliminado");
    setProductos((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">{productos.length} producto{productos.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => { setAddOpen(!addOpen); setAddForm({ nombre: "", temp_min: "", temp_max: "" }); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${addOpen ? "border border-brand-200 text-brand-700 hover:bg-brand-50" : "bg-brand-900 text-white hover:bg-brand-800"}`}
        >
          {addOpen ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block text-sm font-medium text-brand-700">
              Nombre del producto
              <input type="text" placeholder="Ej. Aguacate Orgánico" value={addForm.nombre}
                onChange={(e) => setAddForm((s) => ({ ...s, nombre: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && add()} className={`mt-1 ${inp}`} />
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Temp. mínima (°C)
              <input type="number" step="0.1" placeholder="0" value={addForm.temp_min}
                onChange={(e) => setAddForm((s) => ({ ...s, temp_min: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && add()} className={`mt-1 ${inp}`} />
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Temp. máxima (°C)
              <input type="number" step="0.1" placeholder="10" value={addForm.temp_max}
                onChange={(e) => setAddForm((s) => ({ ...s, temp_max: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && add()} className={`mt-1 ${inp}`} />
            </label>
          </div>
          <button onClick={add} disabled={saving}
            className="mt-3 rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}

      {/* Rows */}
      {productos.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">Sin registros. Agrega el primero.</div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {productos.map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center gap-4 hover:bg-brand-50/40 transition-colors">
              <div className="flex-1 text-sm font-semibold text-brand-900">{p.nombre}</div>

              {editId === p.id ? (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                    Min °C
                    <input type="number" step="0.1" value={editForm.temp_min}
                      onChange={(e) => setEditForm((s) => ({ ...s, temp_min: e.target.value }))}
                      className="w-20 rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                    Max °C
                    <input type="number" step="0.1" value={editForm.temp_max}
                      onChange={(e) => setEditForm((s) => ({ ...s, temp_max: e.target.value }))}
                      className="w-20 rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  <button onClick={() => saveEdit(p.id)}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition">Guardar</button>
                  <button onClick={() => setEditId(null)}
                    className="text-xs text-brand-400 hover:text-brand-600 transition">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-brand-500 tabular-nums">
                    {p.temp_min}° — {p.temp_max}°C
                  </span>
                  <button onClick={() => startEdit(p)}
                    className="text-xs text-brand-400 hover:text-brand-700 hover:underline transition shrink-0">
                    Editar
                  </button>
                  <button onClick={() => remove(p.id)} disabled={deleting === p.id}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition shrink-0">
                    {deleting === p.id ? "…" : "Eliminar"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Combinados ───────────────────────────────────────────────────────────────

function CombinadosView({ productos, initialCombinaciones }: { productos: Producto[]; initialCombinaciones: Combinacion[] }) {
  const [combos, setCombos]     = useState<Combinacion[]>(initialCombinaciones);
  const [addOpen, setAddOpen]   = useState(false);
  const [form, setForm]         = useState({ producto_a_id: "", producto_b_id: "", temp_min: "", temp_max: "" });
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ temp_min: "", temp_max: "" });

  async function add() {
    if (!form.producto_a_id || !form.producto_b_id) { toast.error("Selecciona ambos productos"); return; }
    if (form.producto_a_id === form.producto_b_id)  { toast.error("Los productos deben ser diferentes"); return; }
    if (!form.temp_min || !form.temp_max)            { toast.error("Temperaturas requeridas"); return; }
    if (Number(form.temp_min) >= Number(form.temp_max)) { toast.error("Temp mínima debe ser menor a la máxima"); return; }
    setSaving(true);
    const res = await fetch("/api/producto-combinaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, temp_min: Number(form.temp_min), temp_max: Number(form.temp_max) }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Combinación agregada");
    setCombos((c) => [...c, json.data as Combinacion]);
    setForm({ producto_a_id: "", producto_b_id: "", temp_min: "", temp_max: "" });
    setAddOpen(false);
  }

  function startEdit(c: Combinacion) {
    setEditId(c.id);
    setEditForm({ temp_min: String(c.temp_min), temp_max: String(c.temp_max) });
  }

  async function saveEdit(id: string) {
    if (Number(editForm.temp_min) >= Number(editForm.temp_max)) { toast.error("Temp mínima debe ser menor a la máxima"); return; }
    const res = await fetch(`/api/producto-combinaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_min: Number(editForm.temp_min), temp_max: Number(editForm.temp_max) }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Actualizado");
    setCombos((c) => c.map((x) => (x.id === id ? (json.data as Combinacion) : x)));
    setEditId(null);
  }

  async function remove(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/producto-combinaciones/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Eliminado");
    setCombos((c) => c.filter((x) => x.id !== id));
  }

  const sel = `rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full`;

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">{combos.length} combinación{combos.length !== 1 ? "es" : ""}</span>
        <button
          onClick={() => { setAddOpen(!addOpen); setForm({ producto_a_id: "", producto_b_id: "", temp_min: "", temp_max: "" }); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${addOpen ? "border border-brand-200 text-brand-700 hover:bg-brand-50" : "bg-brand-900 text-white hover:bg-brand-800"}`}
        >
          {addOpen ? "Cancelar" : "+ Agregar combinación"}
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-sm font-medium text-brand-700">
              Producto A
              <select value={form.producto_a_id} onChange={(e) => setForm((s) => ({ ...s, producto_a_id: e.target.value }))} className={`mt-1 ${sel}`}>
                <option value="">— Selecciona —</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Producto B
              <select value={form.producto_b_id} onChange={(e) => setForm((s) => ({ ...s, producto_b_id: e.target.value }))} className={`mt-1 ${sel}`}>
                <option value="">— Selecciona —</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Temp. mínima (°C)
              <input type="number" step="0.1" placeholder="0" value={form.temp_min}
                onChange={(e) => setForm((s) => ({ ...s, temp_min: e.target.value }))}
                className={`mt-1 ${inp}`} />
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Temp. máxima (°C)
              <input type="number" step="0.1" placeholder="10" value={form.temp_max}
                onChange={(e) => setForm((s) => ({ ...s, temp_max: e.target.value }))}
                className={`mt-1 ${inp}`} />
            </label>
          </div>
          <button onClick={add} disabled={saving}
            className="mt-3 rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition">
            {saving ? "Guardando…" : "Guardar combinación"}
          </button>
        </div>
      )}

      {/* Rows */}
      {combos.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">Sin combinaciones. Agrega la primera.</div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {combos.map((c) => (
            <li key={c.id} className="px-5 py-3 flex items-center gap-4 hover:bg-brand-50/40 transition-colors">
              <div className="flex-1 text-sm font-semibold text-brand-900">
                {c.producto_a.nombre}
                <span className="mx-2 text-brand-300">+</span>
                {c.producto_b.nombre}
              </div>

              {editId === c.id ? (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                    Min °C
                    <input type="number" step="0.1" value={editForm.temp_min}
                      onChange={(e) => setEditForm((s) => ({ ...s, temp_min: e.target.value }))}
                      className="w-20 rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-brand-600 font-medium">
                    Max °C
                    <input type="number" step="0.1" value={editForm.temp_max}
                      onChange={(e) => setEditForm((s) => ({ ...s, temp_max: e.target.value }))}
                      className="w-20 rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  <button onClick={() => saveEdit(c.id)}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition">Guardar</button>
                  <button onClick={() => setEditId(null)}
                    className="text-xs text-brand-400 hover:text-brand-600 transition">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-brand-500 tabular-nums shrink-0">
                    {c.temp_min}° — {c.temp_max}°C
                  </span>
                  <button onClick={() => startEdit(c)}
                    className="text-xs text-brand-400 hover:text-brand-700 hover:underline transition shrink-0">
                    Editar
                  </button>
                  <button onClick={() => remove(c.id)} disabled={deleting === c.id}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition shrink-0">
                    {deleting === c.id ? "…" : "Eliminar"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Shell con tabs ───────────────────────────────────────────────────────────

export function ProductosClient({
  productos,
  combinaciones,
}: {
  productos: Producto[];
  combinaciones: Combinacion[];
}) {
  const [tab, setTab] = useState<"individuales" | "combinados">("individuales");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-brand-50 border border-brand-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab("individuales")} className={`${tabBase} ${tab === "individuales" ? tabActive : tabInactive}`}>
          Individuales
        </button>
        <button onClick={() => setTab("combinados")} className={`${tabBase} ${tab === "combinados" ? tabActive : tabInactive}`}>
          Combinados
        </button>
      </div>

      {tab === "individuales" ? (
        <IndividualesView initialProductos={productos} />
      ) : (
        <CombinadosView productos={productos} initialCombinaciones={combinaciones} />
      )}
    </div>
  );
}
