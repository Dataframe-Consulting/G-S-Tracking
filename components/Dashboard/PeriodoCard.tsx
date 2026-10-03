import type { Status } from "@/lib/types";

/**
 * Resumen del periodo. Reemplaza las cinco tarjetas de estatus por un solo
 * número grande con la composición en una barra apilada: así el total es el
 * único "héroe" de la página y el desglose se lee de un vistazo.
 */

type Segmento = { label: string; valor: number; clase: string; punto: string };

export function PeriodoCard({
  total,
  porStatus,
  desde,
  hasta,
}: {
  total: number;
  porStatus: Record<Status, number>;
  desde: string;
  hasta: string;
}) {
  const pendientes = (porStatus.PENDIENTE ?? 0) + (porStatus.EN_PREPARACION ?? 0);

  const segmentos: Segmento[] = [
    { label: "Entregadas", valor: porStatus.ENTREGADO ?? 0, clase: "bg-brand-900", punto: "bg-brand-900" },
    { label: "En tránsito", valor: porStatus.TRANSITO ?? 0, clase: "bg-brand-500", punto: "bg-brand-500" },
    { label: "Pendientes", valor: pendientes, clase: "bg-brand-300", punto: "bg-brand-300" },
    { label: "Rechazos", valor: porStatus.RECHAZO_CALIDAD ?? 0, clase: "bg-red-500", punto: "bg-red-500" },
  ];

  const visibles = segmentos.filter((s) => s.valor > 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-brand-500">
          Periodo
        </span>
        <span className="ml-auto text-xs text-brand-400 tabular-nums">
          {fmt(desde)} – {fmt(hasta)}
        </span>
      </div>

      <div className="rounded-xl border border-brand-100 bg-white p-5">
        <div className="text-xs font-medium text-brand-500">Cargas totales</div>
        <div className="font-display font-extrabold text-[52px] leading-none tabular-nums text-brand-900 mt-1">
          {total}
        </div>

        {total > 0 ? (
          <>
            {/* flex-grow proporcional, con mínimo para que un segmento de 1 carga
                siga siendo visible en la barra. */}
            <div className="flex gap-0.5 h-3 mt-5 mb-3">
              {visibles.map((s) => (
                <div
                  key={s.label}
                  className={`${s.clase} rounded-sm min-w-[4px]`}
                  style={{ flexGrow: s.valor }}
                  title={`${s.label}: ${s.valor}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {segmentos.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-2 text-brand-500">
                  <span className={`w-2.5 h-2.5 rounded-sm ${s.punto}`} />
                  {s.label}
                  <span className="font-medium text-brand-900 tabular-nums">
                    {s.valor} · {pct(s.valor)}%
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 text-sm text-brand-400">No hay cargas en este periodo.</div>
        )}
      </div>
    </section>
  );
}

function fmt(f: string) {
  const [y, m, d] = f.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[Number(m) - 1]} ${y}`;
}
