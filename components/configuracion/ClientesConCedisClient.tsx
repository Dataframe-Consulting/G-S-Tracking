"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { Cliente, Cedi } from "@/lib/types";

type ClienteConCedis = Cliente & { cedis?: Cedi[] };

export function ClientesConCedisClient({
  initialData,
}: {
  initialData: ClienteConCedis[];
}) {
  const [clientes, setClientes] = useState<ClienteConCedis[]>(initialData);
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [clienteForm, setClienteForm] = useState({ nombre: "", contacto: "" });
  const [savingCliente, setSavingCliente] = useState(false);
  const [deletingCliente, setDeletingCliente] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cediForm, setCediForm] = useState<Record<string, string>>({});
  const [savingCedi, setSavingCedi] = useState<string | null>(null);
  const [deletingCedi, setDeletingCedi] = useState<string | null>(null);

  const inp =
    "rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition w-full";

  async function addCliente() {
    if (!clienteForm.nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSavingCliente(true);
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: clienteForm.nombre.trim(),
        contacto: clienteForm.contacto.trim() || null,
      }),
    });
    setSavingCliente(false);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Cliente agregado");
    setClientes((prev) =>
      [...prev, { ...json.data, cedis: [] }].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      )
    );
    setClienteForm({ nombre: "", contacto: "" });
    setShowAddCliente(false);
  }

  async function removeCliente(id: string) {
    setDeletingCliente(id);
    const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    setDeletingCliente(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Cliente eliminado");
    setClientes((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function addCedi(clienteId: string) {
    const nombre = (cediForm[clienteId] ?? "").trim();
    if (!nombre) { toast.error("Nombre del cedi requerido"); return; }
    setSavingCedi(clienteId);
    const res = await fetch(`/api/clientes/${clienteId}/cedis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    setSavingCedi(null);
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Error al guardar"); return; }
    toast.success("Cedi agregado");
    setCediForm((f) => ({ ...f, [clienteId]: "" }));
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? {
              ...c,
              cedis: [...(c.cedis ?? []), json.data as Cedi].sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
              ),
            }
          : c
      )
    );
  }

  async function removeCedi(clienteId: string, cediId: string) {
    setDeletingCedi(cediId);
    const res = await fetch(`/api/clientes/${clienteId}/cedis/${cediId}`, { method: "DELETE" });
    setDeletingCedi(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || "Error"); return; }
    toast.success("Cedi eliminado");
    setClientes((prev) =>
      prev.map((c) =>
        c.id === clienteId
          ? { ...c, cedis: (c.cedis ?? []).filter((d) => d.id !== cediId) }
          : c
      )
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between gap-3">
        <span className="text-sm text-brand-500">
          {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setShowAddCliente(!showAddCliente); setClienteForm({ nombre: "", contacto: "" }); }}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
            showAddCliente
              ? "border border-brand-200 text-brand-700 hover:bg-brand-50"
              : "bg-brand-900 text-white hover:bg-brand-800"
          }`}
        >
          {showAddCliente ? "Cancelar" : "+ Agregar cliente"}
        </button>
      </div>

      {/* Formulario nuevo cliente */}
      {showAddCliente && (
        <div className="px-5 py-4 bg-brand-50/60 border-b border-brand-100">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-brand-700">
              Nombre del cliente
              <input
                type="text"
                placeholder="Ej. Walmart México"
                value={clienteForm.nombre}
                onChange={(e) => setClienteForm((f) => ({ ...f, nombre: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCliente()}
                className={`mt-1 ${inp}`}
              />
            </label>
            <label className="block text-sm font-medium text-brand-700">
              Contacto
              <input
                type="text"
                placeholder="Correo, teléfono, etc."
                value={clienteForm.contacto}
                onChange={(e) => setClienteForm((f) => ({ ...f, contacto: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addCliente()}
                className={`mt-1 ${inp}`}
              />
            </label>
          </div>
          <div className="mt-3">
            <button
              onClick={addCliente}
              disabled={savingCliente}
              className="rounded-xl bg-brand-900 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition"
            >
              {savingCliente ? "Guardando…" : "Guardar cliente"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      {clientes.length === 0 ? (
        <div className="px-5 py-10 text-center text-brand-300 text-sm italic">
          Sin clientes. Agrega el primero.
        </div>
      ) : (
        <ul className="divide-y divide-brand-50">
          {clientes.map((cliente) => {
            const isExpanded = expandedId === cliente.id;
            const cedis = cliente.cedis ?? [];
            return (
              <li key={cliente.id}>
                {/* Fila del cliente */}
                <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-brand-50/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-brand-900">{cliente.nombre}</div>
                    {cliente.contacto && (
                      <div className="text-xs text-brand-400 mt-0.5">{cliente.contacto}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : cliente.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-900 transition"
                    >
                      <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                      <span>
                        {cedis.length > 0
                          ? `${cedis.length} cedi${cedis.length !== 1 ? "s" : ""}`
                          : "Cedis"}
                      </span>
                    </button>
                    <button
                      onClick={() => removeCliente(cliente.id)}
                      disabled={deletingCliente === cliente.id}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition"
                    >
                      {deletingCliente === cliente.id ? "…" : "Eliminar"}
                    </button>
                  </div>
                </div>

                {/* Panel de cedis */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-brand-50/30 border-t border-brand-50">
                    {cedis.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 mb-3">
                        {cedis.map((cedi) => (
                          <li
                            key={cedi.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white border border-brand-100 px-3 py-2"
                          >
                            <span className="text-sm text-brand-800">{cedi.nombre}</span>
                            <button
                              onClick={() => removeCedi(cliente.id, cedi.id)}
                              disabled={deletingCedi === cedi.id}
                              className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 transition shrink-0"
                            >
                              {deletingCedi === cedi.id ? "…" : "Eliminar"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-brand-300 italic mt-3 mb-3">
                        Sin cedis. Agrega el primero.
                      </p>
                    )}

                    {/* Mini-form agregar cedi */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. Walmart Hermosillo Norte"
                        value={cediForm[cliente.id] ?? ""}
                        onChange={(e) =>
                          setCediForm((f) => ({ ...f, [cliente.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && addCedi(cliente.id)}
                        className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-brand-300 transition"
                      />
                      <button
                        onClick={() => addCedi(cliente.id)}
                        disabled={savingCedi === cliente.id}
                        className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60 transition shrink-0"
                      >
                        {savingCedi === cliente.id ? "…" : "+ Cedi"}
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
