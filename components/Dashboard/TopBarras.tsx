import Link from "next/link";
import type { FilaAgrupada } from "@/lib/dashboard";

/**
 * Top de transportistas o clientes en barras horizontales. Las verticales no
 * dejaban leer nombres como "Antonio Cortéz" o "NUEVA WALMART DE MEXICO".
 *
 * El subtítulo es un insight calculado, no un texto fijo: cambia según la
 * concentración real del periodo.
 */
export function TopBarras({
  titulo,
  filas,
  href,
  tipo,
}: {
  titulo: string;
  filas: FilaAgrupada[];
  href: string;
  tipo: "transportista" | "cliente";
}) {
  const top = filas.slice(0, 8);
  const mayor = top[0]?.cargas ?? 0;

  // Insight: en transportistas interesa si uno concentra el volumen; en clientes,
  // qué tanto pesan los tres principales.
  let insight: string;
  if (top.length === 0) {
    insight = "Sin datos en el periodo";
  } else if (tipo === "transportista") {
    insight =
      top[0].pct > 40
        ? `${top[0].nombre} concentra ${Math.round(top[0].pct)}% del volumen`
        : `${filas.length} transportista${filas.length === 1 ? "" : "s"} en el periodo`;
  } else {
    const tres = Math.round(top.slice(0, 3).reduce((n, f) => n + f.pct, 0));
    insight = `Los 3 primeros suman ${tres}%`;
  }

  // Se destaca el #1 en transportistas y el top 3 en clientes.
  const destacado = (i: number) => (tipo === "transportista" ? i === 0 : i < 3);

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-5">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display font-bold text-[15px] text-brand-900">{titulo}</h2>
        <Link
          href={href}
          className="ml-auto text-xs font-medium text-brand-500 hover:text-brand-900 transition whitespace-nowrap"
        >
          Ver todos →
        </Link>
      </div>
      <p className="text-xs text-brand-400 mt-0.5 mb-3">{insight}</p>

      {top.length === 0 ? (
        <div className="py-8 text-center text-sm text-brand-400">Sin cargas en el periodo.</div>
      ) : (
        <div className="space-y-0.5">
          {top.map((f, i) => (
            <Link
              key={f.nombre}
              href={`${href}?ver=${encodeURIComponent(f.nombre)}`}
              className="grid grid-cols-[minmax(0,96px)_1fr_auto] items-center gap-3 rounded-md px-1 py-1.5 hover:bg-brand-50 transition-colors"
            >
              <span className="truncate text-[13px] text-brand-900" title={f.nombre}>
                {f.nombre}
              </span>
              <span className="h-2.5 rounded-full bg-brand-50 overflow-hidden">
                <span
                  className={`block h-full rounded-full ${destacado(i) ? "bg-brand-900" : "bg-brand-300"}`}
                  style={{ width: `${mayor > 0 ? (f.cargas / mayor) * 100 : 0}%` }}
                />
              </span>
              <span className="text-xs text-brand-400 tabular-nums whitespace-nowrap">
                <b className="font-medium text-brand-900">{f.cargas}</b> · {Math.round(f.pct)}%
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
