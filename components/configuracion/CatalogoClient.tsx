"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export interface CatalogoField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "email" | "tel";
  required?: boolean;
  primary?: boolean;   // first/bold field shown in the row
  mono?: boolean;      // monospace rendering
}

export type Row = Record<string, string | number | null | undefined>;

export function CatalogoClient({
  endpoint,
  initialData,
  fields
}: {
  endpoint: string;
  initialData: Row[];
  fields: CatalogoField[];
}) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const primaryField = fields.find((f) => f.primary) ?? fields[0];
  const secondaryFields = fields.filter((f) => f.key !== primaryField.key);

  function resetForm() {
    setForm({});
    setOpen(false);
  }

  async function add() {
    for (const f of fields) {
      if (f.required !== false && !form[f.key]?.trim()) {
        toast.error(`${f.label} es requerido`);
        return;
      }
    }
    setSaving(true);
    const body: Record<string, string | number | null> = {};
    for (const f of fields) {
      const val = form[f.key]?.trim() ?? "";
      body[f.key] = f.type === "number" ? (val ? Number(val) : null) : (val || null);
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Guardado");
    setRows((r) =>
      [...r, json.data as Row].sort((a, b) =>
        String(a[primaryField.key] ?? "").localeCompare(String(b[primaryField.key] ?? ""))
      )
    );
    resetForm();
  }

  function startEdit(row: Row) {
    const id = String(row.id);
    setEditId(id);
    const ef: Record<string, string> = {};
    for (const f of fields) ef[f.key] = String(row[f.key] ?? "");
    setEditForm(ef);
  }

  async function saveEdit(id: string) {
    for (const f of fields) {
      if (f.required !== false && !editForm[f.key]?.trim()) {
        toast.error(`${f.label} es requerido`);
        return;
      }
    }
    const body: Record<string, string | number | null> = {};
    for (const f of fields) {
      const val = editForm[f.key]?.trim() ?? "";
      body[f.key] = f.type === "number" ? (val ? Number(val) : null) : (val || null);
    }
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Actualizado");
    setRows((r) => r.map((x) => (String(x.id) === id ? (json.data as Row) : x)));
    setEditId(null);
  }

  async function remove(id: string) {
    setDeleting(id);
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Eliminado");
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const inp = "rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">
          {rows.length} registro{rows.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setOpen(!open); setForm({}); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
            open
              ? "border border-brand-200 text-brand-700 hover:bg-brand-50"
              : "bg-brand-900 text-white hover:bg-brand-800"
          }`}
        >
          {open ? "Cancelar" : "+ Agregar"}
        </button>
      </div>

      {/* Add form */}
      {open && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <div className={`grid gap-3 ${fields.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {fields.map((f) => (
              <label key={f.key} className="block text-sm font-medium text-brand-700">
                {f.label}
                <input
                  type={f.type ?? "text"}
                  placeholder={f.placeholder ?? f.label}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  className={`mt-1 ${inp} ${f.mono ? "font-mono" : ""}`}
                  step={f.type === "number" ? "0.1" : undefined}
                />
              </label>
            ))}
          </div>
          <div className="mt-3">
            <button
              onClick={add}
              disabled={saving}
              className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">
          Sin registros. Agrega el primero.
        </div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {rows.map((row) => {
            const id = String(row.id);
            const isEditing = editId === id;
            return (
              <li key={id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-brand-50/40 transition-colors">
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-2 flex-wrap">
                    {fields.map((f) => (
                      <input
                        key={f.key}
                        type={f.type ?? "text"}
                        value={editForm[f.key] ?? ""}
                        onChange={(e) => setEditForm((s) => ({ ...s, [f.key]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(id)}
                        placeholder={f.placeholder ?? f.label}
                        className={`rounded-lg border border-brand-200 px-2 py-1 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 ${f.mono ? "font-mono" : ""} ${fields.length === 1 ? "flex-1" : "w-44"}`}
                        step={f.type === "number" ? "0.1" : undefined}
                      />
                    ))}
                    <button onClick={() => saveEdit(id)} className="text-xs font-semibold text-brand-700 hover:text-brand-900 transition shrink-0">Guardar</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-brand-400 hover:text-brand-600 transition shrink-0">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold text-brand-900 ${primaryField.mono ? "font-mono" : ""}`}>
                        {String(row[primaryField.key] ?? "—")}
                      </div>
                      {secondaryFields.map((f) => {
                        const val = row[f.key];
                        if (!val) return null;
                        return (
                          <div key={f.key} className={`text-xs text-brand-400 mt-0.5 ${f.mono ? "font-mono" : ""}`}>
                            {f.type === "number" ? `${f.label}: ${val}` : String(val)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => startEdit(row)} className="text-xs text-brand-400 hover:text-brand-700 hover:underline transition">
                        Editar
                      </button>
                      <button
                        onClick={() => remove(id)}
                        disabled={deleting === id}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition"
                      >
                        {deleting === id ? "…" : "Eliminar"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
