import type { CadenaFrio } from "@/lib/dashboard";

/**
 * Cumplimiento de cadena de frío: qué porcentaje de las lecturas del periodo
 * estuvieron dentro del rango del viaje. Es el dato que mide el negocio y que
 * hasta ahora no se mostraba en ninguna pantalla, aunque lleva meses
 * registrándose en `lecturas_temperatura`.
 */
export function CadenaFrioCard({ frio }: { frio: CadenaFrio }) {
  const pct = frio.pctEnRango;

  // Semáforo sobrio: el color refuerza la lectura sin convertir la tarjeta en
  // una alarma. El ámbar es el del acento de la app, no un color nuevo.
  const tono =
    pct == null ? "text-brand-300" : pct >= 85 ? "text-brand-700" : pct >= 60 ? "text-accent" : "text-red-600";

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-brand-500">
          Cadena de frío
        </span>
        <span className="text-xs text-brand-400">
          {frio.lecturas > 0
            ? `${frio.lecturas.toLocaleString("es-MX")} lecturas en el periodo`
            : "Sin lecturas en el periodo"}
        </span>
      </div>

      <div className="rounded-xl border border-brand-100 bg-white p-5">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          <div>
            <div className={`font-display font-extrabold text-[46px] leading-none tabular-nums ${tono}`}>
              {pct == null ? "—" : `${pct}%`}
            </div>
            <div className="text-xs text-brand-500 mt-1.5">
              {pct == null ? "No hay lecturas para calcularlo" : "del tiempo dentro de rango"}
            </div>
          </div>

          {frio.termografosSinReportar > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <div className="text-xs font-semibold text-amber-800">
                {frio.termografosSinReportar} termógrafo
                {frio.termografosSinReportar === 1 ? "" : "s"} sin reportar
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                Asignados a viajes en curso, más de 6 h sin señal
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
