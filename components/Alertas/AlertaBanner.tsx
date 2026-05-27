import { cToF } from "@/lib/temperature";

export function AlertaBanner({
  active,
  tempActual,
  tempMin,
  tempMax,
}: {
  active: boolean;
  tempActual: number | null;
  tempMin?: number | null;
  tempMax?: number | null;
}) {
  if (!active || tempActual == null) return null;
  const isHigh = tempMax != null && tempActual > Number(tempMax);

  const tempActualF = cToF(tempActual);
  const tempMinF = cToF(tempMin);
  const tempMaxF = cToF(tempMax);

  return (
    <div
      className={`rounded-lg border-l-[3px] px-5 py-4 flex items-start gap-3.5 ${
        isHigh
          ? "border-red-500 bg-red-50"
          : "border-blue-500 bg-blue-50"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-4 h-4 mt-0.5 shrink-0 ${isHigh ? "text-red-500" : "text-blue-500"}`}
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
      </svg>
      <div>
        <p className={`text-sm font-semibold ${isHigh ? "text-red-800" : "text-blue-800"}`}>
          {isHigh ? "Temperatura fuera de rango — ALTA" : "Temperatura fuera de rango — BAJA"}
        </p>
        <p className={`text-sm mt-0.5 ${isHigh ? "text-red-700" : "text-blue-700"}`}>
          Lectura actual <strong>{tempActualF != null ? tempActualF.toFixed(1) : "—"}°F</strong>
          {tempMinF != null && tempMaxF != null && (
            <> &middot; Rango permitido {tempMinF.toFixed(1)}°F – {tempMaxF.toFixed(1)}°F</>
          )}
        </p>
      </div>
    </div>
  );
}
