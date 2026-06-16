"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Producto, RangoTemperatura } from "@/lib/types";
import { cToF, fToC } from "@/lib/temperature";

const inp =
  "rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-brand-300 transition";

function rangoLabel(r: { temp_min: number; temp_max: number }): string {
  return `${(cToF(r.temp_min) as number).toFixed(0)}–${(cToF(r.temp_max) as number).toFixed(0)}°F`;
}

// Multiselect de productos como chips toggle. Marca cuáles están en OTRO rango.
function ProductoPicker({
  productos,
  selected,
  rangoActualId,
  onToggle,
}: {
  productos: Producto[];
  selected: Set<string>;
  rangoActualId: string | null;
  onToggle: (id: string) => void;
}) {
  if (productos.length === 0) {
    return <p className="text-xs text-brand-300 italic">No hay productos en el catálogo.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {productos.map((p) => {
        const isSel = selected.has(p.id);
        const enOtro = p.rango_id != null && p.rango_id !== rangoActualId && !isSel;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            title={enOtro ? "Está en otro rango; se moverá a este" : undefined}
            className={`text-xs px-2.5 py-1 rounded-lg border transition ${
              isSel
                ? "bg-brand-900 text-white border-brand-900"
                : "bg-white text-brand-700 border-brand-200 hover:border-brand-400"
            }`}
          >
            {p.nombre}
            {enOtro && <span className="ml-1 text-amber-500">•</span>}
          </button>
        );
      })}
    </div>
  );
}

export function RangosClient({
  rangos: initialRangos,
  productos: initialProductos,
}: {
  rangos: RangoTemperatura[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [rangos, setRangos] = useState(initialRangos);
  const [productos, setProductos] = useState(initialProductos);
  useEffect(() => setRangos(initialRangos), [initialRangos]);
  useEffect(() => setProductos(initialProductos), [initialProductos]);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ min: "", max: "" });
  const [addSel, setAddSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ min: "", max: "" });
  const [editSel, setEditSel] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function parseRange(form: { min: string; max: string }): { minC: number; maxC: number } | null {
    const minF = parseFloat(form.min);
    const maxF = parseFloat(form.max);
    if (Number.isNaN(minF) || Number.isNaN(maxF)) {
      toast.error("Ingresa mínimo y máximo");
      return null;
    }
    if (minF >= maxF) {
      toast.error("El mínimo debe ser menor que el máximo");
      return null;
    }
    return { minC: fToC(minF) as number, maxC: fToC(maxF) as number };
  }

  async function addRango() {
    const r = parseRange(addForm);
    if (!r) return;
    setSaving(true);
    const res = await fetch("/api/rangos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_min: r.minC, temp_max: r.maxC, producto_ids: [...addSel] }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Error al crear el rango");
      return;
    }
    toast.success("Rango creado");
    setShowAdd(false);
    setAddForm({ min: "", max: "" });
    setAddSel(new Set());
    router.refresh();
  }

  function startEdit(r: RangoTemperatura) {
    setEditId(r.id);
    setEditForm({
      min: (cToF(r.temp_min) as number).toFixed(0),
      max: (cToF(r.temp_max) as number).toFixed(0),
    });
    setEditSel(new Set((r.productos ?? []).map((p) => p.id)));
  }

  async function saveEdit(id: string) {
    const r = parseRange(editForm);
    if (!r) return;
    setSaving(true);
    const res = await fetch(`/api/rangos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temp_min: r.minC, temp_max: r.maxC, producto_ids: [...editSel] }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Error al guardar");
      return;
    }
    toast.success("Rango actualizado");
    setEditId(null);
    router.refresh();
  }

  async function removeRango(id: string) {
    if (!confirm("¿Eliminar este rango? Los productos y viajes quedarán sin este rango.")) return;
    setDeleting(id);
    const res = await fetch(`/api/rangos/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Rango eliminado");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header + agregar */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-brand-50">
          <span className="text-xs text-brand-400">
            {rangos.length} rango{rangos.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => {
              setShowAdd((s) => !s);
              setAddForm({ min: "", max: "" });
              setAddSel(new Set());
            }}
            className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
              showAdd
                ? "border border-brand-200 text-brand-700 hover:bg-brand-50"
                : "bg-brand-900 text-white hover:bg-brand-800"
            }`}
          >
            {showAdd ? "Cancelar" : "+ Agregar rango"}
          </button>
        </div>

        {showAdd && (
          <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="mín"
                value={addForm.min}
                onChange={(e) => setAddForm((f) => ({ ...f, min: e.target.value }))}
                className={`${inp} w-24`}
              />
              <span className="text-brand-400">—</span>
              <input
                type="number"
                placeholder="máx"
                value={addForm.max}
                onChange={(e) => setAddForm((f) => ({ ...f, max: e.target.value }))}
                className={`${inp} w-24`}
              />
              <span className="text-xs text-brand-400">°F</span>
            </div>
            <div>
              <div className="text-xs font-medium text-brand-500 mb-1.5">Productos en este rango</div>
              <ProductoPicker
                productos={productos}
                selected={addSel}
                rangoActualId={null}
                onToggle={(id) => setAddSel((s) => toggle(s, id))}
              />
            </div>
            <button
              onClick={addRango}
              disabled={saving}
              className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition"
            >
              {saving ? "Guardando…" : "Guardar rango"}
            </button>
          </div>
        )}

        {rangos.length === 0 ? (
          <div className="px-5 py-6 text-sm text-brand-300 text-center italic">
            Sin rangos. Agrega el primero.
          </div>
        ) : (
          <ul className="divide-y divide-brand-50">
            {rangos.map((r) => {
              const isEditing = editId === r.id;
              return (
                <li key={r.id} className="px-5 py-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editForm.min}
                          onChange={(e) => setEditForm((f) => ({ ...f, min: e.target.value }))}
                          className={`${inp} w-24`}
                        />
                        <span className="text-brand-400">—</span>
                        <input
                          type="number"
                          value={editForm.max}
                          onChange={(e) => setEditForm((f) => ({ ...f, max: e.target.value }))}
                          className={`${inp} w-24`}
                        />
                        <span className="text-xs text-brand-400">°F</span>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-brand-500 mb-1.5">Productos en este rango</div>
                        <ProductoPicker
                          productos={productos}
                          selected={editSel}
                          rangoActualId={r.id}
                          onToggle={(id) => setEditSel((s) => toggle(s, id))}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => saveEdit(r.id)}
                          disabled={saving}
                          className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition"
                        >
                          {saving ? "…" : "Guardar"}
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-sm text-brand-500 hover:text-brand-900 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-brand-900">{rangoLabel(r)}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(r.productos ?? []).length > 0 ? (
                            (r.productos ?? []).map((p) => (
                              <span
                                key={p.id}
                                className="text-xs px-2 py-0.5 rounded-md bg-brand-50 text-brand-700"
                              >
                                {p.nombre}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-brand-300 italic">Sin productos</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs text-brand-500 hover:text-brand-900 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeRango(r.id)}
                          disabled={deleting === r.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                        >
                          {deleting === r.id ? "…" : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
