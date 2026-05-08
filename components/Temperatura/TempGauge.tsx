export function TempGauge({
  value,
  min,
  max,
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
    <div className="rounded-xl border border-brand-100 bg-white px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-brand-400">Temperatura actual</span>
        <span className={`text-2xl font-bold tabular-nums ${out ? "text-red-600" : "text-brand-700"}`}>
          {value == null ? "—" : `${value.toFixed(1)}°C`}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-blue-200 via-brand-200 to-red-200">
        <div
          className="absolute top-0 bottom-0 bg-brand-500/20 border-l-2 border-r-2 border-brand-500/50 rounded-sm"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {value != null && (
          <div
            className={`absolute -top-1 -bottom-1 w-[3px] rounded-full ${out ? "bg-red-500" : "bg-brand-900"}`}
            style={{ left: `calc(${pct}% - 1.5px)` }}
          />
        )}
      </div>

      <div className="flex justify-between text-[11px] text-brand-400 mt-2 tabular-nums">
        <span>{lower.toFixed(0)}°</span>
        <span className="text-brand-600 font-medium">{min}° – {max}°</span>
        <span>{upper.toFixed(0)}°</span>
      </div>
    </div>
  );
}
