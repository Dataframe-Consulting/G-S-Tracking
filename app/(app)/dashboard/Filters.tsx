"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_LABELS, STATUS_VALUES } from "@/lib/types";

export function DashboardFilters({ fecha, status }: { fecha: string; status: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/dashboard?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
      <label className="text-sm">
        <span className="text-slate-600 mr-2">Fecha</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => updateParam("fecha", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="text-slate-600 mr-2">Status</span>
        <select
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white"
        >
          <option value="">Todos</option>
          {STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => router.push("/dashboard")}
        className="text-xs text-slate-500 hover:text-slate-700 underline"
      >
        Limpiar
      </button>
    </div>
  );
}
