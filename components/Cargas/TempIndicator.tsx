import { cToF } from "@/lib/temperature";

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
  const out =
    min != null && max != null ? value < Number(min) || value > Number(max) : false;
  const valueF = cToF(value);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
        out ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${out ? "bg-red-500" : "bg-emerald-500"}`} />
      {valueF != null ? valueF.toFixed(1) : "—"}°F
    </span>
  );
}
