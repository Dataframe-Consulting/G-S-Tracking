export function AlertaBanner({
  active,
  tempActual,
  tempMin,
  tempMax
}: {
  active: boolean;
  tempActual: number | null;
  tempMin?: number | null;
  tempMax?: number | null;
}) {
  if (!active || tempActual == null) return null;
  const type =
    tempMax != null && tempActual > Number(tempMax)
      ? "🔴 Temperatura ALTA"
      : "🔵 Temperatura BAJA";
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-3">
      <span className="text-lg">⚠️</span>
      <div>
        <div className="font-semibold">{type}</div>
        <div>
          Lectura actual <b>{tempActual.toFixed(1)}°C</b>
          {tempMin != null && tempMax != null && (
            <> — rango permitido {Number(tempMin)}°C a {Number(tempMax)}°C</>
          )}
        </div>
      </div>
    </div>
  );
}
