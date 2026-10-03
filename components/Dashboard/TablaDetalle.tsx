"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FilaAgrupada } from "@/lib/dashboard";
import { STATUS_LABELS, STATUS_CLASSES, type Status } from "@/lib/types";

export type CargaDetalle = {
  id: string;
  fecha: string;
  ovRef: string | null;
  cliente: string;
  transportista: string;
  productos: string[];
  status: Status;
  viajeNumero: number | null;
  viajeConAlerta: boolean;
};

type Col = "nombre" | "cargas" | "pct" | "viajesConAlerta" | "rechazos" | "ultimaCarga";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtFecha = (f: string | null) =>
  f ? `${f.slice(8, 10)} ${MESES[Number(f.slice(5, 7)) - 1]}` : "—";

function Sparkline({ serie }: { serie: number[] }) {
  const max = Math.max(...serie, 1);
  return (
    <span className="flex items-end gap-px h-5" aria-hidden>
      {serie.map((n, i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-brand-300"
          style={{ height: `${Math.max(8, (n / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function Num({ n }: { n: number }) {
  return n > 0 ? (
    <span className="font-medium text-red-600">{n}</span>
  ) : (
    <span className="text-brand-300">0</span>
  );
}

export function TablaDetalle({
  tipo,
  filas,
  cargas,
  opcionesFiltro,
  dias,
}: {
  tipo: "transportista" | "cliente";
  filas: FilaAgrupada[];
  /** Todas las cargas del periodo, para armar el detalle del modal sin otra query. */
  cargas: CargaDetalle[];
  /** Clientes (si tipo=transportista) o transportistas (si tipo=cliente). */
  opcionesFiltro: string[];
  /** Días del periodo, en el mismo orden que `serie`. Para el tooltip. */
  dias: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [busqueda, setBusqueda] = useState("");
  const [cruce, setCruce] = useState("");
  const [orden, setOrden] = useState<{ col: Col; desc: boolean }>({ col: "cargas", desc: true });
  const [abierto, setAbierto] = useState<string | null>(params.get("ver"));

  // Cerrar con Escape, como el resto de los modales de la app.
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [abierto]);

  const esTransp = tipo === "transportista";
  const etiqueta = esTransp ? "Transportista" : "Cliente";
  const etiquetaCruce = esTransp ? "Cliente" : "Transportista";

  const visibles = useMemo(() => {
    let out = filas;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter((f) => f.nombre.toLowerCase().includes(q));
    }
    if (cruce) {
      // Se recalcula contra las cargas para que el cruce filtre de verdad.
      const nombres = new Set(
        cargas
          .filter((c) => (esTransp ? c.cliente === cruce : c.transportista === cruce))
          .map((c) => (esTransp ? c.transportista : c.cliente))
      );
      out = out.filter((f) => nombres.has(f.nombre));
    }
    const dir = orden.desc ? -1 : 1;
    return [...out].sort((a, b) => {
      const x = a[orden.col] ?? 0;
      const y = b[orden.col] ?? 0;
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * dir;
      return ((x as number) - (y as number)) * dir;
    });
  }, [filas, busqueda, cruce, orden, cargas, esTransp]);

  const ficha = abierto ? filas.find((f) => f.nombre === abierto) : null;
  const cargasFicha = useMemo(
    () =>
      abierto
        ? cargas
            .filter((c) => (esTransp ? c.transportista === abierto : c.cliente === abierto))
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
        : [],
    [abierto, cargas, esTransp]
  );

  function abrir(nombre: string) {
    setAbierto(nombre);
    const next = new URLSearchParams(params.toString());
    next.set("ver", nombre);
    router.replace(`?${next}`, { scroll: false });
  }
  function cerrar() {
    setAbierto(null);
    const next = new URLSearchParams(params.toString());
    next.delete("ver");
    router.replace(next.toString() ? `?${next}` : "?", { scroll: false });
  }

  const Th = ({ col, children, num }: { col: Col; children: React.ReactNode; num?: boolean }) => (
    <th
      onClick={() => setOrden((o) => ({ col, desc: o.col === col ? !o.desc : true }))}
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-brand-700 transition ${
        num ? "text-right" : "text-left"
      }`}
    >
      {children}
      {orden.col === col && <span className="ml-1 text-brand-500">{orden.desc ? "▾" : "▴"}</span>}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 bg-white border border-brand-100 rounded-2xl px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-brand-700 font-medium">
          {etiquetaCruce}
          <select
            value={cruce}
            onChange={(e) => setCruce(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos</option>
            {opcionesFiltro.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
          className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-sm text-brand-900 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-56"
        />
        <span className="text-xs text-brand-400 sm:ml-auto">
          Da clic en un {etiqueta.toLowerCase()} para ver su historial
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-brand-50 text-[11px] uppercase tracking-widest text-brand-400">
            <tr>
              <Th col="nombre">{etiqueta}</Th>
              <Th col="cargas" num>Cargas</Th>
              <Th col="pct" num>% volumen</Th>
              {esTransp && <Th col="viajesConAlerta" num>Viajes c/ alerta</Th>}
              <Th col="rechazos" num>Rechazos</Th>
              {!esTransp && <th className="px-4 py-3 font-medium text-left">Productos principales</th>}
              {!esTransp && <Th col="ultimaCarga">Última carga</Th>}
              <th className="px-4 py-3 font-medium text-left">Tendencia</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-brand-400">
                  No hay resultados con estos filtros.
                </td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr
                  key={f.nombre}
                  onClick={() => abrir(f.nombre)}
                  className="border-t border-brand-50 cursor-pointer hover:bg-brand-50/60 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-brand-900 whitespace-nowrap">{f.nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-700">{f.cargas}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-500">{f.pct}%</td>
                  {esTransp && (
                    <td className="px-4 py-3 text-right tabular-nums">
                      <Num n={f.viajesConAlerta} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Num n={f.rechazos} />
                  </td>
                  {!esTransp && (
                    <td className="px-4 py-3 text-xs text-brand-500">
                      {f.productos.length > 0 ? f.productos.join(", ") : "—"}
                    </td>
                  )}
                  {!esTransp && (
                    <td className="px-4 py-3 text-brand-500 whitespace-nowrap">
                      {fmtFecha(f.ultimaCarga)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Sparkline serie={f.serie} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ficha && (
        <FichaModal
          tipo={tipo}
          fila={ficha}
          cargas={cargasFicha}
          dias={dias}
          onClose={cerrar}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FichaModal({
  tipo,
  fila,
  cargas,
  dias,
  onClose,
}: {
  tipo: "transportista" | "cliente";
  fila: FilaAgrupada;
  cargas: CargaDetalle[];
  dias: string[];
  onClose: () => void;
}) {
  const esTransp = tipo === "transportista";
  const [fStatus, setFStatus] = useState("");
  const [fCruce, setFCruce] = useState("");

  const opciones = useMemo(
    () => Array.from(new Set(cargas.map((c) => (esTransp ? c.cliente : c.transportista)))).sort(),
    [cargas, esTransp]
  );

  const visibles = cargas.filter(
    (c) =>
      (!fStatus || c.status === fStatus) &&
      (!fCruce || (esTransp ? c.cliente : c.transportista) === fCruce)
  );

  const maxSerie = Math.max(...fila.serie, 1);

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-900/45 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-brand-100">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium">
              {esTransp ? "Transportista" : "Cliente"}
            </div>
            <h2 className="font-display font-extrabold text-xl text-brand-900 truncate">
              {fila.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-auto text-brand-400 hover:text-brand-900 transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Cargas" valor={String(fila.cargas)} />
            <Kpi label="% del volumen" valor={`${fila.pct}%`} />
            {esTransp ? (
              <Kpi label="Viajes con alerta" valor={String(fila.viajesConAlerta)} malo={fila.viajesConAlerta > 0} />
            ) : (
              <Kpi label="Última carga" valor={fmtFecha(fila.ultimaCarga)} />
            )}
            <Kpi label="Rechazos" valor={String(fila.rechazos)} malo={fila.rechazos > 0} />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium mb-2">
              Cargas por día
            </div>
            {/* Las barras reparten TODO el ancho disponible. Con un max-width
                fijo se amontonaban a la izquierda y la gráfica parecía cortada
                en los periodos de pocos días. */}
            <div className="flex items-end gap-[2px] h-20 border-b border-brand-100">
              {fila.serie.map((n, i) => (
                <div
                  key={i}
                  className={`flex-1 min-w-0 rounded-t-sm ${n === maxSerie && n > 0 ? "bg-brand-900" : "bg-brand-300"}`}
                  style={{ height: `${n > 0 ? Math.max(6, (n / maxSerie) * 100) : 2}%` }}
                  title={`${dias[i] ? fmtFecha(dias[i]) + " · " : ""}${n} carga${n === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={fCruce}
              onChange={(e) => setFCruce(e.target.value)}
              className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs text-brand-900"
            >
              <option value="">{esTransp ? "Todos los clientes" : "Todos los transportistas"}</option>
              {opciones.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              className="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs text-brand-900"
            >
              <option value="">Todos los estatus</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <span className="text-xs text-brand-400 self-center ml-auto tabular-nums">
              {visibles.length} de {cargas.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-100 max-h-80 overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-brand-50 text-[10px] uppercase tracking-widest text-brand-400 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    {esTransp ? "Cliente" : "Transportista"}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Producto</th>
                  <th className="px-3 py-2.5 text-left font-medium">Estatus</th>
                  {esTransp && <th className="px-3 py-2.5 text-left font-medium">Viaje c/ alerta</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-brand-400">
                      Sin cargas con estos filtros.
                    </td>
                  </tr>
                ) : (
                  visibles.map((c) => (
                    <tr key={c.id} className="border-t border-brand-50">
                      <td className="px-3 py-2.5 text-brand-900 whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                      <td className="px-3 py-2.5 text-brand-700">
                        {esTransp ? c.cliente : c.transportista}
                      </td>
                      <td className="px-3 py-2.5 text-brand-500">
                        {c.productos.length > 0 ? c.productos.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASSES[c.status]}`}
                        >
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      {esTransp && (
                        <td className="px-3 py-2.5">
                          {c.viajeConAlerta ? (
                            <span className="font-medium text-red-600">Sí</span>
                          ) : (
                            <span className="text-brand-300">No</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, malo }: { label: string; valor: string; malo?: boolean }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-3.5 py-3">
      <div className="text-[11px] text-brand-500">{label}</div>
      <div
        className={`font-display font-bold text-xl tabular-nums mt-0.5 ${malo ? "text-red-600" : "text-brand-900"}`}
      >
        {valor}
      </div>
    </div>
  );
}
