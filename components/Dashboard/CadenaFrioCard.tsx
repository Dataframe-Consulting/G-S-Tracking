"use client";

import { useState, useEffect } from "react";
import type { CadenaFrio, DetalleFrio } from "@/lib/dashboard";

/**
 * Cumplimiento de cadena de frío: de todas las mediciones de temperatura que
 * tomaron los termógrafos en el periodo, qué parte cayó dentro del rango
 * permitido del producto que llevaba cada viaje.
 *
 * El dato lleva meses registrándose en `lecturas_temperatura` y no se mostraba
 * en ninguna pantalla.
 */
export function CadenaFrioCard({ frio, detalle }: { frio: CadenaFrio; detalle: DetalleFrio }) {
  const [abierto, setAbierto] = useState(false);
  const pct = frio.pctEnRango;
  const fuera = frio.lecturas - frio.enRango;
  const n = (x: number) => x.toLocaleString("es-MX");

  // El color significa siempre lo mismo: verde = dentro de rango, rojo = fuera.
  // El número es el % de cumplimiento, así que va en verde aunque sea bajo: la
  // severidad se lee en cuánto rojo tiene la barra, no en el color del número.
  const pctFuera = frio.lecturas > 0 ? Math.round((fuera / frio.lecturas) * 1000) / 10 : 0;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-brand-500">
          Cadena de frío
        </span>
        {frio.lecturas > 0 && (
          <button
            onClick={() => setAbierto(true)}
            className="ml-auto text-xs font-medium text-brand-500 hover:text-brand-900 transition"
          >
            Ver detalle →
          </button>
        )}
      </div>

      <div className="rounded-xl border border-brand-100 bg-white p-5">
        {frio.lecturas === 0 ? (
          <div className="text-sm text-brand-400">
            No hay mediciones de temperatura en este periodo.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[auto_1fr] gap-x-8 gap-y-4 items-start">
            <div>
              <div className="font-display font-extrabold text-[46px] leading-none tabular-nums text-brand-700">
                {pct}%
              </div>
              <div className="text-xs font-medium text-brand-500 mt-1.5">dentro de rango</div>
            </div>

            <div className="min-w-0">
              {/* Anchos en porcentaje, no flex-grow: así la barra refleja la
                  proporción exacta y no depende de cómo el navegador reparta
                  el espacio libre. */}
              <div className="flex h-2.5 rounded-sm overflow-hidden bg-brand-50 mb-2">
                <div
                  className="bg-brand-600"
                  style={{ width: `${pct ?? 0}%` }}
                  title={`Dentro de rango: ${n(frio.enRango)}`}
                />
                <div
                  className="bg-red-400"
                  style={{ width: `${pctFuera}%` }}
                  title={`Fuera de rango: ${n(fuera)}`}
                />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mb-3">
                <span className="inline-flex items-center gap-1.5 text-brand-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-brand-600" />
                  Dentro de rango
                  <b className="font-medium text-brand-900 tabular-nums">{n(frio.enRango)}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-brand-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                  Fuera de rango
                  <b className="font-medium text-brand-900 tabular-nums">
                    {n(fuera)} · {pctFuera}%
                  </b>
                </span>
              </div>
              <p className="text-[13px] text-brand-600 leading-relaxed max-w-prose">
                De las <b className="font-medium text-brand-900">{n(frio.lecturas)}</b> mediciones de
                temperatura que tomaron los termógrafos en este periodo,{" "}
                <b className="font-medium text-brand-900">{n(frio.enRango)}</b> estuvieron dentro del
                rango permitido del producto y{" "}
                <b className="font-medium text-brand-900">{n(fuera)}</b> fuera.
              </p>
            </div>
          </div>
        )}
      </div>

      {abierto && <ModalDetalle frio={frio} detalle={detalle} onClose={() => setAbierto(false)} />}
    </section>
  );
}

// ---------------------------------------------------------------------------

function ModalDetalle({
  frio,
  detalle,
  onClose,
}: {
  frio: CadenaFrio;
  detalle: DetalleFrio;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const n = (x: number) => x.toLocaleString("es-MX");
  const maxT = Math.max(...detalle.porTransportista.map((t) => t.alertas), 1);

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-900/45 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-brand-100">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium">
              Cadena de frío
            </div>
            <h2 className="font-display font-extrabold text-xl text-brand-900">
              Detalle del periodo
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-auto text-brand-400 hover:text-brand-900 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-2.5">
              Cómo se calcula
            </h3>
            <p className="text-[13px] text-brand-600 leading-relaxed">
              Cada termógrafo manda una medición de temperatura cada pocos minutos. Cada medición
              se compara contra el rango permitido del producto que lleva ese viaje. El porcentaje
              es cuántas de esas mediciones cayeron dentro del rango.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Mini label="Mediciones" valor={n(frio.lecturas)} />
              <Mini label="Dentro de rango" valor={n(frio.enRango)} />
              <Mini label="Fuera de rango" valor={n(frio.lecturas - frio.enRango)} malo />
            </div>
          </div>

          {detalle.porTransportista.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-1">
                Dónde se concentran las excursiones
              </h3>
              <p className="text-[11px] text-brand-400 mb-3">
                Alertas de temperatura enviadas en el periodo, por transportista. Una alerta se
                dispara cuando un viaje lleva 30 minutos seguidos fuera de rango.
              </p>
              <div className="space-y-1.5">
                {detalle.porTransportista.slice(0, 6).map((t) => (
                  <div
                    key={t.nombre}
                    className="grid grid-cols-[minmax(0,110px)_1fr_auto] items-center gap-3 text-[13px]"
                  >
                    <span className="truncate text-brand-900" title={t.nombre}>
                      {t.nombre}
                    </span>
                    <span className="h-2 rounded-full bg-brand-50 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-red-400"
                        style={{ width: `${(t.alertas / maxT) * 100}%` }}
                      />
                    </span>
                    <span className="text-xs text-brand-500 tabular-nums whitespace-nowrap">
                      <b className="font-medium text-brand-900">{n(t.alertas)}</b> en {t.viajes}{" "}
                      viaje{t.viajes === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detalle.viajes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">
                Viajes con más alertas
              </h3>
              <div className="overflow-x-auto rounded-xl border border-brand-100">
                <table className="min-w-full text-xs">
                  <thead className="bg-brand-50 text-[10px] uppercase tracking-widest text-brand-400">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium">Viaje</th>
                      <th className="px-3 py-2.5 text-left font-medium">Transportista</th>
                      <th className="px-3 py-2.5 text-left font-medium">Cliente</th>
                      <th className="px-3 py-2.5 text-right font-medium">Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.viajes.slice(0, 8).map((v) => (
                      <tr key={v.viajeId} className="border-t border-brand-50">
                        <td className="px-3 py-2.5 font-medium text-brand-900 whitespace-nowrap">
                          #{String(v.numero).padStart(4, "0")}
                        </td>
                        <td className="px-3 py-2.5 text-brand-600">{v.transportista}</td>
                        <td className="px-3 py-2.5 text-brand-600">{v.cliente}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-red-600">
                          {n(v.alertas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, valor, malo }: { label: string; valor: string; malo?: boolean }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-2.5">
      <div className="text-[11px] text-brand-500">{label}</div>
      <div
        className={`font-display font-bold text-lg tabular-nums mt-0.5 ${malo ? "text-red-600" : "text-brand-900"}`}
      >
        {valor}
      </div>
    </div>
  );
}
