export function KpiCards({
  total,
  enTransito,
  alertas,
  entregadas
}: {
  total: number;
  enTransito: number;
  alertas: number;
  entregadas: number;
}) {
  const cards = [
    { label: "Cargas hoy", value: total, color: "bg-brand-50 text-brand-900" },
    { label: "En tránsito", value: enTransito, color: "bg-amber-50 text-amber-800" },
    { label: "Alertas activas", value: alertas, color: "bg-red-50 text-red-700" },
    { label: "Entregadas", value: entregadas, color: "bg-emerald-50 text-emerald-800" }
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border border-slate-200 p-4 ${c.color}`}
        >
          <div className="text-xs uppercase tracking-wide opacity-80">{c.label}</div>
          <div className="text-2xl font-bold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
