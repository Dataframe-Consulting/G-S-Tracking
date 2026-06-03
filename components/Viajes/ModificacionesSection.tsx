"use client";

import { useState } from "react";
import type { Auditoria } from "@/lib/types";

function tiempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

function TimelineEntry({ entry }: { entry: Auditoria }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-brand-300" />
      <div className="text-xs text-brand-400">
        {tiempoRelativo(entry.created_at)} · {entry.user_nombre ?? "Usuario desconocido"}
      </div>
      <div className="text-sm text-brand-800">{entry.descripcion}</div>
    </li>
  );
}

function HistorialModal({
  numero,
  entries,
  onClose,
}: {
  numero: number;
  entries: Auditoria[];
  onClose: () => void;
}) {
  const modificaciones = entries.filter((e) => e.tipo === "MODIFICACION");
  const creaciones = entries.filter((e) => e.tipo === "CREACION");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-brand-100 w-full max-w-lg overflow-y-auto max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-50">
          <div className="font-display font-bold text-brand-900">
            Historial de cambios
            <span className="ml-2 font-mono text-brand-400 font-normal text-sm">
              Viaje #{String(numero).padStart(4, "0")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-brand-400 hover:text-brand-700 transition text-lg leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {entries.length === 0 && (
            <div className="text-sm text-brand-400 text-center py-6">Sin modificaciones aún.</div>
          )}

          {modificaciones.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                ✏️ Modificaciones
              </div>
              <ul className="space-y-3">
                {modificaciones.map((e) => (
                  <TimelineEntry key={e.id} entry={e} />
                ))}
              </ul>
            </div>
          )}

          {creaciones.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">
                🆕 Creación
              </div>
              <ul className="space-y-3">
                {creaciones.map((e) => (
                  <TimelineEntry key={e.id} entry={e} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModificacionesSection({
  numero,
  auditoria,
}: {
  numero: number;
  auditoria: Auditoria[];
}) {
  const [showModal, setShowModal] = useState(false);
  const ultima = auditoria[0] ?? null;

  return (
    <>
      {showModal && (
        <HistorialModal numero={numero} entries={auditoria} onClose={() => setShowModal(false)} />
      )}

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full text-left rounded-2xl border border-brand-100 bg-white shadow-sm px-5 py-4 hover:border-brand-300 transition"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-widest text-brand-400 font-medium">
            Última modificación
          </span>
          <span className="text-xs font-medium text-brand-600">Ver todo →</span>
        </div>
        {ultima ? (
          <div className="flex items-center gap-2.5">
            <span className="text-base">👤</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-brand-900 truncate">
                {ultima.user_nombre ?? "Usuario desconocido"}
              </div>
              <div className="text-xs text-brand-400">{tiempoRelativo(ultima.created_at)}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-brand-400">Sin modificaciones aún</div>
        )}
      </button>
    </>
  );
}
