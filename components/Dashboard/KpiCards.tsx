const icons = {
  "Cargas totales": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="1" y="3" width="15" height="13" rx="1.5"/><path d="M16 8h3l3 4v4h-6V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  "En tránsito": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
    </svg>
  ),
  "Alertas activas": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>
    </svg>
  ),
  "Entregadas": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
} as const;

const cards = [
  { label: "Cargas totales",  accentBg: "bg-brand-900",  accentText: "text-brand-900" },
  { label: "En tránsito",     accentBg: "bg-accent",     accentText: "text-accent"    },
  { label: "Alertas activas", accentBg: "bg-red-500",    accentText: "text-red-500"   },
  { label: "Entregadas",      accentBg: "bg-brand-500",  accentText: "text-brand-500" },
] as const;

export function KpiCards({
  total,
  enTransito,
  alertas,
  entregadas,
}: {
  total: number;
  enTransito: number;
  alertas: number;
  entregadas: number;
}) {
  const values = [total, enTransito, alertas, entregadas];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="bg-white border border-brand-100 rounded-xl overflow-hidden shadow-[0_1px_16px_-6px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_24px_-6px_rgba(0,0,0,0.12)]"
        >
          <div className={`h-[2px] ${c.accentBg}`} />
          <div className="px-5 pt-4 pb-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-brand-400">{c.label}</span>
              <span className={`${c.accentText} opacity-40`}>{icons[c.label]}</span>
            </div>
            <div
              className={`text-[2.75rem] font-display font-bold tabular-nums leading-none ${
                i === 2 && values[i] > 0 ? "text-red-600" : "text-brand-900"
              }`}
            >
              {values[i]}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
