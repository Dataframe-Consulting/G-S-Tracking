import { STATUS_VALUES, STATUS_LABELS, type Status } from "@/lib/types";

const truckIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="1" y="3" width="15" height="13" rx="1.5"/><path d="M16 8h3l3 4v4h-6V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const alertIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>
  </svg>
);

// Acento (línea superior) por status — mismos colores que los badges de la app.
const statusAccent: Record<Status, string> = {
  PENDIENTE: "bg-slate-400",
  EN_PREPARACION: "bg-blue-500",
  TRANSITO: "bg-amber-500",
  ENTREGADO: "bg-emerald-500",
  RECHAZO_CALIDAD: "bg-red-500",
};

function Card({
  label,
  value,
  accentBg,
  icon,
  highlight,
  subtitle,
}: {
  label: string;
  value: number;
  accentBg: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-brand-100 rounded-xl overflow-hidden shadow-[0_1px_16px_-6px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_24px_-6px_rgba(0,0,0,0.12)]">
      <div className={`h-[2px] ${accentBg}`} />
      <div className="px-5 pt-4 pb-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-brand-400">{label}</span>
          {icon && <span className="text-brand-400 opacity-40">{icon}</span>}
        </div>
        <div
          className={`text-[2.75rem] font-display font-bold tabular-nums leading-none ${
            highlight && value > 0 ? "text-red-600" : "text-brand-900"
          }`}
        >
          {value}
        </div>
        {subtitle && <span className="text-[11px] text-brand-300">{subtitle}</span>}
      </div>
    </div>
  );
}

export function KpiCards({
  total,
  alertas,
  porStatus,
}: {
  total: number;
  alertas: number;
  porStatus: Record<Status, number>;
}) {
  return (
    <div className="space-y-3">
      {/* Resumen: total de cargas + alertas (métrica transversal, no suma al total) */}
      <div className="grid grid-cols-2 gap-3">
        <Card label="Cargas totales" value={total} accentBg="bg-brand-900" icon={truckIcon} />
        <Card
          label="Alertas activas"
          value={alertas}
          accentBg="bg-red-500"
          icon={alertIcon}
          highlight
          subtitle="Viajes con temperatura fuera de rango"
        />
      </div>

      {/* Desglose por estatus — la suma de estas tarjetas = Cargas totales */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2 px-0.5">
          Por estatus
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STATUS_VALUES.map((s) => (
            <Card
              key={s}
              label={STATUS_LABELS[s]}
              value={porStatus[s] ?? 0}
              accentBg={statusAccent[s]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
