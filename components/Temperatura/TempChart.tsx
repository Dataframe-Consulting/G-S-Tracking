"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import type { LecturaTemperatura } from "@/lib/types";

export function TempChart({
  lecturas,
  min,
  max
}: {
  lecturas: LecturaTemperatura[];
  min: number;
  max: number;
}) {
  const data = [...lecturas]
    .reverse()
    .map((l) => ({
      t: new Date(l.timestamp).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
      }),
      temp: Number(l.temperatura)
    }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 h-72">
      <div className="text-sm font-medium text-slate-700 mb-2">Historial de temperatura</div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v: number) => `${v.toFixed(1)}°C`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine y={max} stroke="#dc2626" strokeDasharray="4 4" label={{ value: `Máx ${max}°`, position: "right", fontSize: 10, fill: "#dc2626" }} />
          <ReferenceLine y={min} stroke="#2563eb" strokeDasharray="4 4" label={{ value: `Mín ${min}°`, position: "right", fontSize: 10, fill: "#2563eb" }} />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="#085041"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
