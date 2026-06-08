import { cToF, tempEstado } from "@/lib/temperature";

export function TempGauge({
  value,
  min,
  max,
}: {
  value: number | null;
  min: number;
  max: number;
}) {
  const valueF = cToF(value);
  const minF = cToF(min) as number;
  const maxF = cToF(max) as number;

  const span = Math.max(1, maxF - minF);
  const lower = minF - span * 0.5;
  const upper = maxF + span * 0.5;
  const total = upper - lower;
  const pct = valueF == null ? 0 : Math.max(0, Math.min(100, ((valueF - lower) / total) * 100));
  const minPct = ((minF - lower) / total) * 100;
  const maxPct = ((maxF - lower) / total) * 100;

  const estado = tempEstado(value, min, max);
  const valueColor =
    estado === "alta" ? "text-red-600" : estado === "baja" ? "text-blue-600" : "text-brand-900";
  const markerColor =
    estado === "alta" ? "bg-red-500" : estado === "baja" ? "bg-blue-500" : "bg-brand-900";

  return (
    <div className="rounded-xl border border-brand-100 bg-white px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-brand-400">Temperatura actual</span>
        <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>
          {valueF == null ? "—" : `${valueF.toFixed(1)}°F`}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-blue-200 via-brand-200 to-red-200">
        <div
          className="absolute top-0 bottom-0 bg-brand-500/20 border-l-2 border-r-2 border-brand-500/50 rounded-sm"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        {valueF != null && (
          <div
            className={`absolute -top-1 -bottom-1 w-[3px] rounded-full ${markerColor}`}
            style={{ left: `calc(${pct}% - 1.5px)` }}
          />
        )}
      </div>

      <div className="flex justify-between text-[11px] text-brand-400 mt-2 tabular-nums">
        <span>{lower.toFixed(0)}°</span>
        <span className="text-brand-600 font-medium">{minF.toFixed(0)}° – {maxF.toFixed(0)}°</span>
        <span>{upper.toFixed(0)}°</span>
      </div>
    </div>
  );
}
