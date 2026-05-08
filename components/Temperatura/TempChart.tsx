"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { LecturaTemperatura } from "@/lib/types";

export function TempChart({
  lecturas,
  min,
  max,
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
        minute: "2-digit",
      }),
      temp: Number(l.temperatura),
    }));

  return (
    <div className="rounded-xl border border-brand-100 bg-white px-5 pt-4 pb-2 h-72">
      <div className="text-xs font-medium text-brand-500 mb-4">
        Historial de temperatura
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#085041" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#085041" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            horizontal
            vertical={false}
            stroke="#f0f0f0"
            strokeDasharray=""
          />

          <XAxis
            dataKey="t"
            tick={{ fontSize: 10, fill: "#aab4b0" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#aab4b0" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}°`}
          />

          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}°C`, "Temp"]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 10,
              border: "1px solid #e8edeb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              color: "#085041",
            }}
            cursor={{ stroke: "#085041", strokeWidth: 1, strokeDasharray: "4 4" }}
          />

          <ReferenceLine
            y={max}
            stroke="#dc2626"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: `Máx ${max}°`, position: "insideTopRight", fontSize: 9, fill: "#dc2626", dy: -4 }}
          />
          <ReferenceLine
            y={min}
            stroke="#2563eb"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{ value: `Mín ${min}°`, position: "insideBottomRight", fontSize: 9, fill: "#2563eb", dy: 4 }}
          />

          <Area
            type="monotone"
            dataKey="temp"
            stroke="#085041"
            strokeWidth={1.5}
            fill="url(#tempGradient)"
            dot={false}
            activeDot={{ r: 3, fill: "#085041", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
