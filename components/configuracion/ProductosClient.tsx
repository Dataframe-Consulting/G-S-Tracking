"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Producto } from "@/lib/types";

const inp =
  "rounded-xl border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

export function ProductosClient({ productos: initialProductos }: { productos: Producto[] }) {
  const [productos, setProductos] = useState<Producto[]>(initialProductos);
  const [addOpen, setAddOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function add() {
    if (!nombre.trim()) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Producto agregado");
    setProductos((p) => [...p, json.data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setNombre("");
    setAddOpen(false);
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
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">{productos.length} producto{productos.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => { setAddOpen(!addOpen); setNombre(""); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${addOpen ? "border border-brand-200 text-brand-700 hover:bg-brand-50" : "bg-brand-900 text-white hover:bg-brand-800"}`}
        >
          {addOpen ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {addOpen && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <label className="block text-sm font-medium text-brand-700">
            Nombre del producto
            <input type="text" placeholder="Ej. Aguacate Orgánico" value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} className={`mt-1 ${inp}`} />
          </label>
          <button onClick={add} disabled={saving}
            className="mt-3 rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}

      {productos.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">Sin registros. Agrega el primero.</div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {productos.map((p) => (
            <li key={p.id} className="px-5 py-3 flex items-center gap-4 hover:bg-brand-50/40 transition-colors">
              <div className="flex-1 text-sm font-semibold text-brand-900">{p.nombre}</div>
              <button onClick={() => remove(p.id)} disabled={deleting === p.id}
                className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition shrink-0">
                {deleting === p.id ? "…" : "Eliminar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
