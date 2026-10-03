import Link from "next/link";
import type { Ahora } from "@/lib/dashboard";

function Card({
  label,
  valor,
  descripcion,
  alerta,
  href,
}: {
  label: string;
  valor: number;
  descripcion: string;
  alerta?: boolean;
  href?: string;
}) {
  // El rojo solo aparece cuando de verdad hay algo que atender. Con 0 la tarjeta
  // se ve igual que las demás para que el color siga significando algo.
  const encendida = alerta && valor > 0;
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        encendida ? "border-red-200 bg-red-50/70" : "border-brand-100 bg-white"
      }`}
    >
      <div className={`text-xs font-medium ${encendida ? "text-red-700" : "text-brand-500"}`}>
        {label}
      </div>
      <div
        className={`font-display font-bold text-[28px] leading-tight tabular-nums mt-1 ${
          encendida ? "text-red-600" : valor === 0 ? "text-brand-300" : "text-brand-900"
        }`}
      >
        {valor}
      </div>
      {encendida && href ? (
        <Link
          href={href}
          className="mt-1 inline-block text-[11px] font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
        >
          {descripcion} →
        </Link>
      ) : (
        <div className="mt-1 text-[11px] text-brand-400 leading-snug">{descripcion}</div>
      )}
    </div>
  );
}

export function BloqueAhora({ ahora }: { ahora: Ahora }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
        <span className="font-display font-semibold text-xs uppercase tracking-widest text-brand-500">
          Ahora
        </span>
        <span className="text-xs text-brand-400">En vivo · no depende del periodo</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Alertas activas"
          valor={ahora.alertasActivas}
          descripcion="Ver viajes con alerta"
          alerta
          href="/viajes?alerta=1"
        />
        <Card
          label="En tránsito"
          valor={ahora.enTransito}
          descripcion="Cargas en ruta en este momento"
        />
        <Card
          label="Pendiente de carga"
          valor={ahora.pendienteCarga}
          descripcion="Aún sin salir del origen"
        />
        <Card
          label="En proceso de carga"
          valor={ahora.enProceso}
          descripcion="Cargando en este momento"
        />
      </div>
    </section>
  );
}
