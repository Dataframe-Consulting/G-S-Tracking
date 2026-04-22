const icons = {
  "Cargas totales": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 opacity-60">
      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h3l3 4v4h-6V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  "En tránsito": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 opacity-60">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
    </svg>
  ),
  "Alertas activas": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 opacity-60">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  "Entregadas": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 opacity-60">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
} as const;

const cards = [
  {
    label:  "Cargas totales",
    bg:     "bg-brand-500/10",
    border: "border-brand-500/20",
    text:   "text-brand-800",
    sub:    "text-brand-500",
  },
  {
    label:  "En tránsito",
    bg:     "bg-amber-400/10",
    border: "border-amber-400/25",
    text:   "text-amber-800",
    sub:    "text-amber-600",
  },
  {
    label:  "Alertas activas",
    bg:     "bg-red-400/10",
    border: "border-red-400/25",
    text:   "text-red-700",
    sub:    "text-red-400",
  },
  {
    label:  "Entregadas",
    bg:     "bg-brand-300/20",
    border: "border-brand-300/30",
    text:   "text-brand-700",
    sub:    "text-brand-400",
  },
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
          className={`rounded-2xl p-5 flex flex-col gap-3 shadow-sm border ${c.bg} ${c.border}`}
        >
          <div className={`flex items-center justify-between ${c.text}`}>
            <span className={`text-xs font-medium uppercase tracking-widest ${c.sub}`}>
              {c.label}
            </span>
            {icons[c.label]}
          </div>
          <div className={`text-4xl font-display font-extrabold leading-none ${c.text}`}>
            {values[i]}
          </div>
        </div>
      ))}
    </div>
  );
}
