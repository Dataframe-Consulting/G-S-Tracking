"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Pestañas internas del Dashboard. Transportistas y Clientes viven dentro de
 * esta sección en vez de ser módulos propios en el menú lateral, para que la
 * navegación principal no crezca.
 *
 * Los filtros de periodo y producto se conservan al cambiar de pestaña.
 */
const TABS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/transportistas", label: "Transportistas" },
  { href: "/dashboard/clientes", label: "Clientes" },
];

export function TabsDashboard() {
  const pathname = usePathname();
  const params = useSearchParams();

  // Solo se heredan los filtros; `ver` abre el modal de una fila y no debe
  // arrastrarse de una pestaña a otra.
  const qs = new URLSearchParams();
  for (const k of ["fecha_desde", "fecha_hasta", "producto_id"]) {
    const v = params.get(k);
    if (v) qs.set(k, v);
  }
  const sufijo = qs.toString() ? `?${qs}` : "";

  return (
    <div className="flex gap-1 p-1 bg-brand-50 border border-brand-100 rounded-xl w-fit max-w-full overflow-x-auto">
      {TABS.map((t) => {
        const activo = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={`${t.href}${sufijo}`}
            aria-current={activo ? "page" : undefined}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activo
                ? "bg-white text-brand-900 shadow-sm"
                : "text-brand-500 hover:text-brand-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
