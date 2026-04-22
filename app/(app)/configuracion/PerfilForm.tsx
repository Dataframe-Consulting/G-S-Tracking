"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ROLE_LABELS, type Role } from "@/lib/types";

const ROLE_COLORS: Record<string, string> = {
  master:   "bg-brand-900 text-white",
  operador: "bg-accent text-white",
  visor:    "bg-brand-100 text-brand-700"
};

export function PerfilForm({
  nombre: initialNombre,
  email,
  role
}: {
  nombre: string;
  email: string;
  role: string;
}) {
  const [nombre, setNombre] = useState(initialNombre);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Error al guardar");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6">
      <div className="flex flex-wrap items-start gap-6">
        {/* Avatar placeholder */}
        <div className="w-16 h-16 rounded-2xl bg-brand-900 flex items-center justify-center text-white font-display font-extrabold text-2xl shrink-0 select-none">
          {(nombre || email).charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-brand-700">
              Nombre
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition"
              />
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Correo electrónico
              <input
                type="email"
                value={email}
                disabled
                className="mt-1 w-full rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-500 cursor-not-allowed"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-500">Rol:</span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ROLE_COLORS[role] ?? ROLE_COLORS.visor}`}>
                {ROLE_LABELS[role as Role] ?? role}
              </span>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
