"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Role, UserProfile } from "@/lib/types";

const ROLES: { key: Role; label: string; badge: string }[] = [
  { key: "master",   label: "Master",   badge: "bg-brand-900 text-white" },
  { key: "operador", label: "Operador", badge: "bg-accent text-white" },
  { key: "visor",    label: "Visor",    badge: "bg-brand-100 text-brand-700" }
];

const emptyForm = { nombre: "", email: "", password: "" };

const inp = "rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

export function UsuariosClient({
  usuarios: initial,
  currentUserId
}: {
  usuarios: UserProfile[];
  currentUserId: string;
}) {
  const [usuarios, setUsuarios] = useState<UserProfile[]>(initial);
  const [forms, setForms] = useState<Record<Role, typeof emptyForm>>({
    master: { ...emptyForm }, operador: { ...emptyForm }, visor: { ...emptyForm }
  });
  const [showForm, setShowForm] = useState<Record<Role, boolean>>({
    master: false, operador: false, visor: false
  });
  const [saving, setSaving] = useState<Record<Role, boolean>>({
    master: false, operador: false, visor: false
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggleForm(role: Role) {
    setShowForm((s) => ({ ...s, [role]: !s[role] }));
    setForms((f) => ({ ...f, [role]: { ...emptyForm } }));
  }

  async function addUser(role: Role) {
    const { nombre, email, password } = forms[role];
    if (!email || !password) { toast.error("Correo y contraseña requeridos"); return; }
    setSaving((s) => ({ ...s, [role]: true }));
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, nombre: nombre || null })
    });
    setSaving((s) => ({ ...s, [role]: false }));
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al crear"); return; }
    toast.success("Usuario creado");
    setUsuarios((us) => [...us, json.user as UserProfile]);
    setForms((f) => ({ ...f, [role]: { ...emptyForm } }));
    setShowForm((s) => ({ ...s, [role]: false }));
  }

  async function removeUser(userId: string) {
    if (userId === currentUserId) { toast.error("No puedes eliminarte a ti mismo"); return; }
    setDeleting(userId);
    const res = await fetch(`/api/usuarios/${userId}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Usuario eliminado");
    setUsuarios((us) => us.filter((u) => u.id !== userId));
  }

  return (
    <div className="space-y-4">
      {ROLES.map(({ key, label, badge }) => {
        const group = usuarios.filter((u) => u.role === key);
        const form = forms[key];
        const isOpen = showForm[key];
        const isSaving = saving[key];

        return (
          <div key={key} className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-brand-50">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${badge}`}>{label}</span>
                <span className="text-xs text-brand-400">{group.length} usuario{group.length !== 1 ? "s" : ""}</span>
              </div>
              <button
                onClick={() => toggleForm(key)}
                className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                  isOpen
                    ? "border border-brand-200 text-brand-700 hover:bg-brand-50"
                    : "bg-brand-900 text-white hover:bg-brand-800"
                }`}
              >
                {isOpen ? "Cancelar" : "+ Agregar"}
              </button>
            </div>

            {/* Add form */}
            {isOpen && (
              <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
                <div className="grid sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre (opcional)"
                    value={form.nombre}
                    onChange={(e) => setForms((f) => ({ ...f, [key]: { ...f[key], nombre: e.target.value } }))}
                    className={inp}
                  />
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={form.email}
                    onChange={(e) => setForms((f) => ({ ...f, [key]: { ...f[key], email: e.target.value } }))}
                    className={inp}
                  />
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={form.password}
                      onChange={(e) => setForms((f) => ({ ...f, [key]: { ...f[key], password: e.target.value } }))}
                      onKeyDown={(e) => e.key === "Enter" && addUser(key)}
                      className={`${inp} flex-1 min-w-0`}
                    />
                    <button
                      onClick={() => addUser(key)}
                      disabled={isSaving}
                      className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 whitespace-nowrap transition"
                    >
                      {isSaving ? "…" : "Crear"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User list */}
            {group.length === 0 ? (
              <div className="px-5 py-5 text-sm text-brand-300 text-center italic">
                Sin usuarios en este rol.
              </div>
            ) : (
              <ul className="divide-y divide-brand-50">
                {group.map((u) => (
                  <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {u.nombre && (
                        <div className="text-sm font-semibold text-brand-900 truncate">{u.nombre}</div>
                      )}
                      <div className={`text-sm truncate ${u.nombre ? "text-brand-500" : "font-semibold text-brand-900"}`}>
                        {u.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {u.id === currentUserId && (
                        <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2.5 py-0.5 font-medium">
                          tú
                        </span>
                      )}
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => removeUser(u.id)}
                          disabled={deleting === u.id}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 transition"
                        >
                          {deleting === u.id ? "…" : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
