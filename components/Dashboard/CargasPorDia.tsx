"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

export type DiaRow = { fecha: string; total: number };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dia = (f: string) => `${f.slice(8, 10)} ${MESES[Number(f.slice(5, 7)) - 1]}`;

/**
 * Conteos diarios: barras, no línea. Una línea interpola entre días y sugiere
 * una continuidad que no existe — entre el lunes y el martes no hay valores
 * intermedios.
 *
 * El promedio se calcula EXCLUYENDO el día en curso, que casi siempre está
 * incompleto y arrastraría la media hacia abajo.
 */
export function CargasPorDia({ datos, hoy }: { datos: DiaRow[]; hoy: string }) {
  const cerrados = datos.filter((d) => d.fecha !== hoy);
  const base = cerrados.length > 0 ? cerrados : datos;
  const promedio = base.length > 0 ? base.reduce((n, d) => n + d.total, 0) / base.length : 0;

  const max = datos.reduce((m, d) => Math.max(m, d.total), 0);
  const diaMax = datos.find((d) => d.total === max && d.total > 0);

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 className="font-display font-bold text-[15px] text-brand-900">Cargas por día</h2>
        {max > 0 && (
          <span className="text-xs text-brand-400 tabular-nums">
            Máx. {max} el {dia(diaMax!.fecha)} · Prom. {promedio.toFixed(1)}
          </span>
        )}
      </div>

      {datos.length === 0 ? (
        <div className="py-10 text-center text-sm text-brand-400">Sin cargas en el periodo.</div>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke="#eef2ef" vertical={false} />
            <XAxis
              dataKey="fecha"
              tickFormatter={dia}
              tick={{ fontSize: 10.5, fill: "#9AA79F" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10.5, fill: "#9AA79F" }}
              tickLine={false}
              axisLine={false}
              // Ancho suficiente para los números: con un margen izquierdo
              // negativo el eje quedaba fuera del lienzo y las cifras salían
              // cortadas por la mitad.
              width={30}
            />
            <Tooltip
              cursor={{ fill: "rgba(29,61,41,.05)" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e0ebe3",
                fontSize: 12,
                padding: "6px 10px",
                boxShadow: "0 4px 16px -8px rgba(0,0,0,.25)",
              }}
              labelFormatter={(f: string) => dia(f) + (f === hoy ? " (parcial)" : "")}
              formatter={(v: number) => [`${v} carga${v === 1 ? "" : "s"}`, ""]}
              separator=""
            />
            {promedio > 0 && (
              <ReferenceLine
                y={promedio}
                stroke="#8fb594"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={14}>
              {datos.map((d) => (
                <Cell
                  key={d.fecha}
                  // El máximo se destaca en verde oscuro; el día en curso va
                  // translúcido porque todavía no termina.
                  fill={d.total === max && max > 0 ? "#1D3D29" : "#8fb594"}
                  fillOpacity={d.fecha === hoy ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
