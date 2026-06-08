import { cToF, tempEstado } from "@/lib/temperature";

export function TempIndicator({
  value,
  min,
  max
}: {
  value: number | null;
  min: number | null | undefined;
  max: number | null | undefined;
}) {
  if (value == null) {
    return <span className="text-slate-400 text-xs">—</span>;
  }
  const estado = tempEstado(value, min, max);
  const valueF = cToF(value);

  const styles = {
    alta: { pill: "bg-red-100 text-red-700", dot: "bg-red-500" },
    baja: { pill: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
    ok: { pill: "bg-white border border-brand-200 text-brand-900", dot: "bg-brand-300" },
  }[estado];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${styles.pill}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {valueF != null ? valueF.toFixed(1) : "—"}°F
    </span>
  );
}
