export function TempGauge({
  value,
  min,
  max
}: {
  value: number | null;
  min: number;
  max: number;
}) {
  const span = Math.max(1, max - min);
  const lower = min - span * 0.5;
  const upper = max + span * 0.5;
  const total = upper - lower;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, ((value - lower) / total) * 100));
  const minPct = ((min - lower) / total) * 100;
  const maxPct = ((max - lower) / total) * 100;

  const out = value != null && (value < min || value > max);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-slate-700">Temperatura actual</div>
        <div className={`text-2xl font-bold ${out ? "text-red-600" : "text-emerald-700"}`}>
          {value == null ? "—" : `${value.toFixed(1)}°C`}
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-sky-200 via-emerald-200 to-red-200">
        {/* rango permitido */}
        <div
          className="absolute top-0 bottom-0 bg-emerald-400/40 border-l-2 border-r-2 border-emerald-600"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {/* indicador actual */}
        {value != null && (
          <div
            className="absolute -top-1 -bottom-1 w-1 rounded bg-slate-900"
            style={{ left: `calc(${pct}% - 2px)` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{lower.toFixed(0)}°</span>
        <span className="text-emerald-700 font-medium">
          {min}° — {max}°
        </span>
        <span>{upper.toFixed(0)}°</span>
      </div>
    </div>
  );
}
