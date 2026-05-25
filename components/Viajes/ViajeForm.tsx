"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Transportista } from "@/lib/types";
import { CiudadCombobox } from "@/components/ui/CiudadCombobox";

const field =
  "mt-1 w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition";
const fieldInput =
  "w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-brand-300 transition";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="font-display font-semibold text-brand-900 text-sm uppercase tracking-widest">
        {children}
      </span>
      <div className="flex-1 h-px bg-brand-100" />
    </div>
  );
}

type Usuario = { user_id: string; nombre: string | null; email: string | null };

function usuarioLabel(u: Usuario) {
  return u.nombre ? `${u.nombre} (${u.email})` : (u.email ?? u.user_id);
}

export function ViajeForm({
  transportistas,
  usuarios,
}: {
  transportistas: Transportista[];
  usuarios: { user_id: string; nombre: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    lugar_inicio: "",
    lugar_fin: "",
    fecha_inicio: today,
    fecha_fin: today,
    flete_cargo: "",
    responsable_id: "",
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/viajes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lugar_inicio: form.lugar_inicio,
        lugar_fin: form.lugar_fin,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        flete_cargo: form.flete_cargo || null,
        responsable_id: form.responsable_id || null,
      }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Error al crear");
      return;
    }
    toast.success("Viaje creado");
    router.push(`/viajes/${json.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 space-y-5">

      <SectionTitle>Ruta y fechas</SectionTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="block text-sm font-medium text-brand-700 lg:col-span-2">
          Lugar de inicio (origen)
          <CiudadCombobox
            value={form.lugar_inicio}
            onChange={(v) => update("lugar_inicio", v)}
            placeholder="Hermosillo"
            required
            className="mt-1"
            inputClassName={fieldInput}
          />
        </label>
        <label className="block text-sm font-medium text-brand-700 lg:col-span-2">
          Lugar de fin (destino)
          <CiudadCombobox
            value={form.lugar_fin}
            onChange={(v) => update("lugar_fin", v)}
            placeholder="Tijuana"
            required
            className="mt-1"
            inputClassName={fieldInput}
          />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Fecha de inicio
          <input
            type="date"
            required
            value={form.fecha_inicio}
            onChange={(e) => update("fecha_inicio", e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Fecha de fin
          <input
            type="date"
            required
            value={form.fecha_fin}
            onChange={(e) => update("fecha_fin", e.target.value)}
            className={field}
          />
        </label>
      </div>

      <SectionTitle>Transporte y responsable</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-brand-700">
          Flete (transportista)
          <select
            value={form.flete_cargo}
            onChange={(e) => update("flete_cargo", e.target.value)}
            className={`${field} bg-white`}
          >
            <option value="">— Sin transportista —</option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.nombre}>{t.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-brand-700">
          Responsable
          <select
            value={form.responsable_id}
            onChange={(e) => update("responsable_id", e.target.value)}
            className={`${field} bg-white`}
          >
            <option value="">— Sin responsable —</option>
            {usuarios.map((u) => (
              <option key={u.user_id} value={u.user_id}>{usuarioLabel(u)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-brand-100">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
        >
          {saving ? "Guardando…" : "Crear viaje"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-brand-200 px-6 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
