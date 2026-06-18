"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export interface ChartCargaRow {
  fecha: string;
  total: number;
  transito: number;
  entregadas: number;
  alertas: number;
}

export interface ChartTransportistaRow {
  transportista: string;
  count: number;
}

export interface ChartClienteRow {
  cliente: string;
  count: number;
}

const BRAND = {
  900: "#1a2e05",
  700: "#2d5a0e",
  500: "#4a8c1c",
  300: "#86c654",
  100: "#d1fae5",
  accent: "#f59e0b",
  red: "#ef4444",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-brand-700">
      {children}
    </h2>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-brand-100 rounded-xl p-5 shadow-[0_1px_16px_-6px_rgba(0,0,0,0.08)]">
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// Barras horizontales: cada categoría en su propio renglón (nombre legible),
// la barra crece hacia la derecha. Ideal para nombres largos en móvil.
function HorizontalBars({
  data,
  fill,
}: {
  data: { label: string; count: number }[];
  fill: string;
}) {
  const height = Math.max(140, data.length * 36 + 16);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#4a8c1c" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11, fill: "#1a2e05" }}
          tickLine={false}
          axisLine={false}
          width={110}
          interval={0}
          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + "…" : v)}
        />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", fontSize: 12 }} />
        <Bar dataKey="count" name="Cargas" fill={fill} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Barras verticales (versión original, para desktop).
function VerticalBars({
  data,
  fill,
}: {
  data: { label: string; count: number }[];
  fill: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#4a8c1c" }}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4a8c1c" }} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", fontSize: 12 }} />
        <Bar dataKey="count" name="Cargas" fill={fill} radius={[4, 4, 0, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DashboardCharts({
  byFecha,
  byTransportista,
  byCliente,
}: {
  byFecha: ChartCargaRow[];
  byTransportista: ChartTransportistaRow[];
  byCliente: ChartClienteRow[];
}) {
  const transportistaData = byTransportista.map((r) => ({ label: r.transportista, count: r.count }));
  const clienteData = byCliente.map((r) => ({ label: r.cliente, count: r.count }));

  return (
    <div className="space-y-4">
      {/* Cargas vs Fecha */}
      <ChartCard title="Cargas por fecha">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={byFecha} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 10, fill: "#4a8c1c" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => {
                const [, m, d] = v.split("-");
                return `${d}/${m}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#4a8c1c" }}
              tickLine={false}
              axisLine={false}
              width={32}
              label={{
                value: "Cargas",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fontSize: 11, fill: "#4a8c1c" },
              }}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #d1fae5", fontSize: 12 }}
              labelFormatter={(v: string) => {
                const [y, m, d] = v.split("-");
                return `${d}/${m}/${y}`;
              }}
            />
            <Line dataKey="total" name="Cargas totales" stroke={BRAND[500]} strokeWidth={2.5} dot={false} type="monotone" activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cargas por transportista — horizontal en móvil, vertical en desktop */}
        <ChartCard title="Cargas por transportista">
          <div className="md:hidden">
            <HorizontalBars data={transportistaData} fill={BRAND[500]} />
          </div>
          <div className="hidden md:block">
            <VerticalBars data={transportistaData} fill={BRAND[500]} />
          </div>
        </ChartCard>

        {/* Top clientes — horizontal en móvil, vertical en desktop */}
        <ChartCard title="Cargas por cliente (top 8)">
          <div className="md:hidden">
            <HorizontalBars data={clienteData} fill={BRAND[700]} />
          </div>
          <div className="hidden md:block">
            <VerticalBars data={clienteData} fill={BRAND[700]} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
