"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Concesionario, LineaTransportista } from "@/lib/types";

export function ConcesionariosClient({
  initialData,
}: {
  initialData: Concesionario[];
}) {
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>(initialData);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineaForm, setLineaForm] = useState<Record<string, string>>({});
  const [savingLinea, setSavingLinea] = useState<string | null>(null);
  const [deletingLinea, setDeletingLinea] = useState<string | null>(null);
  const [editLineaId, setEditLineaId] = useState<string | null>(null);
  const [editLineaForm, setEditLineaForm] = useState("");

  const inp =
    "rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

  async function addConcesionario() {
    if (!form.trim()) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    const res = await fetch("/api/concesionarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: form.trim() }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Concesionario agregado");
    setConcesionarios((prev) =>
      [...prev, { ...json.data, lineas_transportista: [] }].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      )
    );
    setForm("");
    setShowAdd(false);
  }

  function startEdit(c: Concesionario) {
    setEditId(c.id);
    setEditForm(c.nombre);
  }

  async function saveEdit(id: string) {
    if (!editForm.trim()) { toast.error("Nombre requerido"); return; }
    const res = await fetch(`/api/concesionarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editForm.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Concesionario actualizado");
    setConcesionarios((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.data } : c)));
    setEditId(null);
  }

  async function removeConcesionario(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/concesionarios/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Concesionario eliminado");
    setConcesionarios((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function addLinea(concesionarioId: string) {
    const nombre = (lineaForm[concesionarioId] ?? "").trim();
    if (!nombre) { toast.error("Nombre de la línea requerido"); return; }
    setSavingLinea(concesionarioId);
    const res = await fetch(`/api/concesionarios/${concesionarioId}/lineas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    setSavingLinea(null);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Línea agregada");
    setLineaForm((f) => ({ ...f, [concesionarioId]: "" }));
    setConcesionarios((prev) =>
      prev.map((c) =>
        c.id === concesionarioId
          ? {
              ...c,
              lineas_transportista: [...(c.lineas_transportista ?? []), json.data as LineaTransportista].sort(
                (a, b) => a.nombre.localeCompare(b.nombre)
              ),
            }
          : c
      )
    );
  }

  function startEditLinea(linea: LineaTransportista) {
    setEditLineaId(linea.id);
    setEditLineaForm(linea.nombre);
  }

  async function saveEditLinea(concesionarioId: string, lineaId: string) {
    if (!editLineaForm.trim()) { toast.error("Nombre requerido"); return; }
    const res = await fetch(`/api/concesionarios/${concesionarioId}/lineas/${lineaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editLineaForm.trim() }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Línea actualizada");
    setConcesionarios((prev) =>
      prev.map((c) =>
        c.id === concesionarioId
          ? {
              ...c,
              lineas_transportista: (c.lineas_transportista ?? []).map((l) =>
                l.id === lineaId ? (json.data as LineaTransportista) : l
              ),
            }
          : c
      )
    );
    setEditLineaId(null);
  }

  async function removeLinea(concesionarioId: string, lineaId: string) {
    setDeletingLinea(lineaId);
    const res = await fetch(`/api/concesionarios/${concesionarioId}/lineas/${lineaId}`, { method: "DELETE" });
    setDeletingLinea(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Línea eliminada");
    setConcesionarios((prev) =>
      prev.map((c) =>
        c.id === concesionarioId
          ? { ...c, lineas_transportista: (c.lineas_transportista ?? []).filter((l) => l.id !== lineaId) }
          : c
      )
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">
          {concesionarios.length} concesionario{concesionarios.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setShowAdd(!showAdd); setForm(""); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
            showAdd
              ? "border border-brand-200 text-brand-700 hover:bg-brand-50"
              : "bg-brand-900 text-white hover:bg-brand-800"
          }`}
        >
          {showAdd ? "Cancelar" : "+ Agregar concesionario"}
        </button>
      </div>

      {/* Formulario nuevo concesionario */}
      {showAdd && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <label className="block text-sm font-medium text-brand-700">
            Nombre del concesionario
            <input
              type="text"
              placeholder="Ej. Ferraris"
              value={form}
              onChange={(e) => setForm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addConcesionario()}
              className={`mt-1 ${inp}`}
            />
          </label>
          <div className="mt-3">
            <button
              onClick={addConcesionario}
              disabled={saving}
              className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition"
            >
              {saving ? "Guardando…" : "Guardar concesionario"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de concesionarios */}
      {concesionarios.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">
          Sin concesionarios. Agrega el primero.
        </div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {concesionarios.map((concesionario) => {
            const isExpanded = expandedId === concesionario.id;
            const lineas = concesionario.lineas_transportista ?? [];
            return (
              <li key={concesionario.id}>
                {/* Fila del concesionario */}
                <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-brand-50/40 transition-colors">
                  {editId === concesionario.id ? (
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={editForm}
                        onChange={(e) => setEditForm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(concesionario.id)}
                        placeholder="Nombre del concesionario"
                        className="rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
                      />
                      <button onClick={() => saveEdit(concesionario.id)} className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition shrink-0">Guardar</button>
                      <button onClick={() => setEditId(null)} className="text-xs text-brand-400 hover:text-brand-600 transition shrink-0">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-brand-900">{concesionario.nombre}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : concesionario.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-900 transition"
                        >
                          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                          <span>
                            {lineas.length > 0
                              ? `${lineas.length} línea${lineas.length !== 1 ? "s" : ""}`
                              : "Líneas"}
                          </span>
                        </button>
                        <button
                          onClick={() => startEdit(concesionario)}
                          className="text-xs text-brand-400 hover:text-brand-700 hover:underline transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => removeConcesionario(concesionario.id)}
                          disabled={deleting === concesionario.id}
                          className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition"
                        >
                          {deleting === concesionario.id ? "…" : "Eliminar"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Panel de líneas */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-brand-50/30 border-t border-brand-50">
                    {lineas.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 mb-3">
                        {lineas.map((linea) => (
                          <li
                            key={linea.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white border border-brand-100 px-3 py-2"
                          >
                            {editLineaId === linea.id ? (
                              <div className="flex flex-1 items-center gap-2">
                                <input
                                  type="text"
                                  value={editLineaForm}
                                  onChange={(e) => setEditLineaForm(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveEditLinea(concesionario.id, linea.id)}
                                  className="flex-1 rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                                <button onClick={() => saveEditLinea(concesionario.id, linea.id)} className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition shrink-0">Guardar</button>
                                <button onClick={() => setEditLineaId(null)} className="text-xs text-brand-400 hover:text-brand-600 transition shrink-0">Cancelar</button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm text-brand-800 flex-1">{linea.nombre}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    onClick={() => startEditLinea(linea)}
                                    className="text-xs text-brand-400 hover:text-brand-700 hover:underline transition"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => removeLinea(concesionario.id, linea.id)}
                                    disabled={deletingLinea === linea.id}
                                    className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition"
                                  >
                                    {deletingLinea === linea.id ? "…" : "Eliminar"}
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-brand-300 italic mt-3 mb-3">
                        Sin líneas transportista. Agrega la primera.
                      </p>
                    )}

                    {/* Mini-form agregar línea */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. Línea Norte"
                        value={lineaForm[concesionario.id] ?? ""}
                        onChange={(e) =>
                          setLineaForm((f) => ({ ...f, [concesionario.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && addLinea(concesionario.id)}
                        className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-brand-300 transition"
                      />
                      <button
                        onClick={() => addLinea(concesionario.id)}
                        disabled={savingLinea === concesionario.id}
                        className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition shrink-0"
                      >
                        {savingLinea === concesionario.id ? "…" : "+ Línea"}
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
  );
}
