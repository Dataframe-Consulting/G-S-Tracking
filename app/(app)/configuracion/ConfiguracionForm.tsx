"use client";

import { useState } from "react";
import toast from "react-hot-toast";

function normalize(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

export function ConfiguracionForm({ initial }: { initial: string[] }) {
  const [numeros, setNumeros] = useState<string[]>(initial);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);

  function add() {
    const n = normalize(nuevo);
    if (!n) return;
    if (numeros.includes(n)) {
      toast.error("Ese número ya está en la lista");
      return;
    }
    setNumeros((xs) => [...xs, n]);
    setNuevo("");
  }

  function remove(target: string) {
    setNumeros((xs) => xs.filter((x) => x !== target));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatarios: numeros })
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Error al guardar");
      return;
    }
    toast.success("Configuración guardada");
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-800">Destinatarios de alertas</h2>
        <p className="text-xs text-slate-500">
          Formato internacional E.164, ej. <code>+521XXXXXXXXXX</code>. Se agrega el prefijo
          <code> whatsapp:</code> automáticamente.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={nuevo}
          placeholder="+521XXXXXXXXXX"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={add}
          type="button"
          className="rounded-md bg-brand-900 px-3 py-2 text-sm text-white hover:bg-brand-800"
        >
          Agregar
        </button>
      </div>

      {numeros.length === 0 ? (
        <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Sin destinatarios configurados.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {numeros.map((n) => (
            <li key={n} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-sm">{n}</span>
              <button
                type="button"
                onClick={() => remove(n)}
                className="text-xs text-red-600 hover:underline"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
