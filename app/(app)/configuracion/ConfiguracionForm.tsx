"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Role, UserProfile } from "@/lib/types";

const ROLES: {
  key: Role;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    key: "master",
    label: "Master",
    icon: "👑",
    desc: "Acceso completo: cargas, usuarios y configuración"
  },
  {
    key: "operador",
    label: "Operadores",
    icon: "🚚",
    desc: "Pueden crear y editar cargas, ver toda la plataforma"
  },
  {
    key: "visor",
    label: "Visores",
    icon: "👁️",
    desc: "Solo lectura — consultan cargas sin poder modificar nada"
  }
];

const emptyForm = { nombre: "", email: "", password: "" };
type FormState = typeof emptyForm;

export function ConfiguracionForm({
  usuarios: initial,
  currentUserId
}: {
  usuarios: UserProfile[];
  currentUserId: string;
}) {
  const [usuarios, setUsuarios] = useState<UserProfile[]>(initial);
  const [forms, setForms] = useState<Record<Role, FormState>>({
    master: { ...emptyForm },
    operador: { ...emptyForm },
    visor: { ...emptyForm }
  });
  const [showForm, setShowForm] = useState<Record<Role, boolean>>({
    master: false,
    operador: false,
    visor: false
  });
  const [saving, setSaving] = useState<Record<Role, boolean>>({
    master: false,
    operador: false,
    visor: false
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  function updateForm(role: Role, field: keyof FormState, value: string) {
    setForms((f) => ({ ...f, [role]: { ...f[role], [field]: value } }));
  }

  function toggleForm(role: Role) {
    setShowForm((sf) => ({ ...sf, [role]: !sf[role] }));
    setForms((f) => ({ ...f, [role]: { ...emptyForm } }));
  }

  async function addUser(role: Role) {
    const { nombre, email, password } = forms[role];
    if (!email || !password) {
      toast.error("Correo y contraseña son requeridos");
      return;
    }
    setSaving((s) => ({ ...s, [role]: true }));
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, nombre: nombre || null })
    });
    setSaving((s) => ({ ...s, [role]: false }));
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error al crear usuario");
      return;
    }
    toast.success("Usuario creado");
    setUsuarios((us) => [...us, json.user as UserProfile]);
    setForms((f) => ({ ...f, [role]: { ...emptyForm } }));
    setShowForm((sf) => ({ ...sf, [role]: false }));
  }

  async function removeUser(userId: string) {
    if (userId === currentUserId) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    setDeleting(userId);
    const res = await fetch(`/api/usuarios/${userId}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error || "Error al eliminar usuario");
      return;
    }
    toast.success("Usuario eliminado");
    setUsuarios((us) => us.filter((u) => u.id !== userId));
  }

  return (
    <div className="space-y-5">
      {ROLES.map(({ key, label, icon, desc }) => {
        const group = usuarios.filter((u) => u.role === key);
        const form = forms[key];
        const isSaving = saving[key];
        const isOpen = showForm[key];

        return (
          <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <span className="font-semibold text-slate-800">{label}</span>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                    {group.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => toggleForm(key)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                {isOpen ? "Cancelar" : "+ Agregar"}
              </button>
            </div>

            {isOpen && (
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <div className="grid sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre (opcional)"
                    value={form.nombre}
                    onChange={(e) => updateForm(key, "nombre", e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={form.email}
                    onChange={(e) => updateForm(key, "email", e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={form.password}
                      onChange={(e) => updateForm(key, "password", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addUser(key)}
                      className="flex-1 min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => addUser(key)}
                      disabled={isSaving}
                      className="rounded-md bg-brand-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      {isSaving ? "..." : "Crear"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {group.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400 italic">
                Sin usuarios en este rol.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {group.map((u) => (
                  <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      {u.nombre && (
                        <div className="text-sm font-medium text-slate-800">{u.nombre}</div>
                      )}
                      <div className={`text-sm ${u.nombre ? "text-slate-500" : "font-medium text-slate-800"}`}>
                        {u.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {u.id === currentUserId && (
                        <span className="text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 py-0.5 font-medium">
                          tú
                        </span>
                      )}
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => removeUser(u.id)}
                          disabled={deleting === u.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deleting === u.id ? "..." : "Eliminar"}
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
