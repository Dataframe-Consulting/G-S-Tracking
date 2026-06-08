"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cToF } from "@/lib/temperature";

export function TempChart({
  lecturas,
  min,
  max,
  viajeId,
}: {
  lecturas: LecturaTemperatura[];
  min: number;
  max: number;
  viajeId?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [fullLecturas, setFullLecturas] = useState<LecturaTemperatura[]>([]);
  const [loading, setLoading] = useState(false);

  const minF = cToF(min) as number;
  const maxF = cToF(max) as number;

  const data = [...lecturas]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((l) => ({
      t: new Date(l.timestamp).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      temp: cToF(Number(l.temperatura)) ?? 0,
    }));

  async function openDetalle() {
    setModalOpen(true);
    if (!viajeId) return;
    setLoading(true);
    const supabase = createBrowserSupabase();
    const { data: rows } = await supabase
      .from("lecturas_temperatura")
      .select("*")
      .eq("viaje_id", viajeId)
      .order("timestamp", { ascending: true });
    setFullLecturas(rows ?? []);
    setLoading(false);
  }

  const fullData = fullLecturas.map((l) => ({
    t: new Date(l.timestamp).toLocaleDateString("es-MX", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    temp: cToF(Number(l.temperatura)) ?? 0,
  }));

  const outOfRange = fullLecturas.filter((l) => l.fuera_rango).length;
  const fullMin = fullData.length ? Math.min(...fullData.map((d) => d.temp)) : null;
  const fullMax = fullData.length ? Math.max(...fullData.map((d) => d.temp)) : null;

  return (
    <>
      <div className="rounded-xl border border-brand-100 bg-white px-5 pt-4 pb-2 h-72">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-medium text-brand-500">
            Historial de temperatura
          </div>
          {viajeId && (
            <button
              onClick={openDetalle}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 underline underline-offset-2 transition-colors"
            >
              Ver detalle
            </button>
          )}
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
              formatter={(v: number) => [`${v.toFixed(1)}°F`, "Temp"]}
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
              y={maxF}
              stroke="#dc2626"
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: `Máx ${maxF.toFixed(0)}°`, position: "insideTopRight", fontSize: 9, fill: "#dc2626", dy: -4 }}
            />
            <ReferenceLine
              y={minF}
              stroke="#2563eb"
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: `Mín ${minF.toFixed(0)}°`, position: "insideBottomRight", fontSize: 9, fill: "#2563eb", dy: 4 }}
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

      {/* Modal historial completo — portal para escapar del transform del carousel */}
      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
              <div>
                <h2 className="text-sm font-semibold text-brand-900">
                  Historial completo de temperatura
                </h2>
                <p className="text-xs text-brand-400 mt-0.5">
                  Desde el encendido del termógrafo hasta hoy
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 hover:bg-brand-50 transition-colors text-brand-400 hover:text-brand-700"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                    <p className="text-xs text-brand-400">Cargando historial...</p>
                  </div>
                </div>
              ) : fullData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-sm text-brand-400">
                  Sin lecturas disponibles
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl bg-brand-50 px-4 py-3">
                      <p className="text-xs text-brand-400 mb-0.5">Total lecturas</p>
                      <p className="text-lg font-semibold text-brand-900">{fullData.length}</p>
                    </div>
                    <div className="rounded-xl bg-red-50 px-4 py-3">
                      <p className="text-xs text-red-400 mb-0.5">Fuera de rango</p>
                      <p className="text-lg font-semibold text-red-700">{outOfRange}</p>
                    </div>
                    <div className="rounded-xl bg-brand-50 px-4 py-3">
                      <p className="text-xs text-brand-400 mb-0.5">Rango registrado</p>
                      <p className="text-lg font-semibold text-brand-900">
                        {fullMin?.toFixed(1)}° – {fullMax?.toFixed(1)}°
                      </p>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={fullData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="tempGradientFull" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#085041" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#085041" stopOpacity={0} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid horizontal vertical={false} stroke="#f0f0f0" />

                        <XAxis
                          dataKey="t"
                          tick={{ fontSize: 9, fill: "#aab4b0" }}
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
                          formatter={(v: number) => [`${v.toFixed(1)}°F`, "Temp"]}
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
                          y={maxF}
                          stroke="#dc2626"
                          strokeDasharray="4 3"
                          strokeWidth={1}
                          label={{ value: `Máx ${maxF.toFixed(0)}°`, position: "insideTopRight", fontSize: 9, fill: "#dc2626", dy: -4 }}
                        />
                        <ReferenceLine
                          y={minF}
                          stroke="#2563eb"
                          strokeDasharray="4 3"
                          strokeWidth={1}
                          label={{ value: `Mín ${minF.toFixed(0)}°`, position: "insideBottomRight", fontSize: 9, fill: "#2563eb", dy: 4 }}
                        />

                        <Area
                          type="monotone"
                          dataKey="temp"
                          stroke="#085041"
                          strokeWidth={1.5}
                          fill="url(#tempGradientFull)"
                          dot={false}
                          activeDot={{ r: 3, fill: "#085041", strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
