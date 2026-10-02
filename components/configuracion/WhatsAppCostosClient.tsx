"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { WhatsAppFacturacion } from "@/lib/types";

type Fila = WhatsAppFacturacion & { pagado_por_nombre?: string | null };

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return `${MESES[m - 1] ?? periodo} ${y}`;
}

const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

function fechaCorta(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function WhatsAppCostosClient({ periodos }: { periodos: Fila[] }) {
  const router = useRouter();
  const [sincronizando, setSincronizando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);

  const pendiente = periodos
    .filter((p) => p.estado === "PENDIENTE")
    .reduce((n, p) => n + Number(p.costo_mxn), 0);

  async function sincronizar() {
    setSincronizando(true);
    const res = await fetch("/api/whatsapp-facturacion", { method: "POST" });
    const json = await res.json();
    setSincronizando(false);
    if (!res.ok) {
      toast.error(json.error || "Error al sincronizar con Meta");
      return;
    }
    toast.success(
      json.congelados > 0
        ? `${json.actualizados} periodo(s) actualizados · ${json.congelados} ya pagados sin tocar`
        : `${json.actualizados} periodo(s) actualizados`
    );
    router.refresh();
  }

  async function marcar(periodo: string, estado: "PAGADO" | "PENDIENTE") {
    setMarcando(periodo);
    const res = await fetch(`/api/whatsapp-facturacion/${periodo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    setMarcando(null);
    if (!res.ok) {
      toast.error(json.error || "Error al actualizar");
      return;
    }
    toast.success(estado === "PAGADO" ? "Marcado como pagado" : "Regresado a pendiente");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          className="rounded-xl bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60 transition shadow-sm"
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar con Meta"}
        </button>
      </div>

      {periodos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-200 p-10 text-center">
          <div className="text-sm text-brand-500">Todavía no hay periodos.</div>
          <div className="text-xs text-brand-400 mt-1">
            Usa “Sincronizar con Meta” para traer los meses facturados.
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-brand-50 text-xs uppercase tracking-widest text-brand-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Mes</th>
                  <th className="px-4 py-3 text-right font-medium">Enviados</th>
                  <th className="px-4 py-3 text-right font-medium">Recibidos</th>
                  <th className="px-4 py-3 text-right font-medium">Costo</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {periodos.map((p) => {
                  const pagado = p.estado === "PAGADO";
                  // Si enviamos bastante más de lo que Meta entregó, algo está
                  // frenando la cuenta (fue así como se detectó el adeudo de sept).
                  const noEntregados = (p.enviados ?? 0) - p.mensajes;
                  const hayBrecha = noEntregados > Math.max(50, p.mensajes * 0.05);
                  return (
                    <tr key={p.periodo} className="border-t border-brand-50">
                      <td className="px-4 py-3 font-medium text-brand-900">
                        {nombreMes(p.periodo)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-brand-700">
                        {(p.enviados ?? 0).toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-brand-700">
                        {p.mensajes.toLocaleString("es-MX")}
                        {hayBrecha && (
                          <div
                            className="text-[11px] font-medium text-amber-700"
                            title="Meta no entregó todos los mensajes que se enviaron"
                          >
                            ⚠ {noEntregados.toLocaleString("es-MX")} sin entregar
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-900">
                        {mxn(Number(p.costo_mxn))}
                      </td>
                      <td className="px-4 py-3">
                        {pagado ? (
                          <div>
                            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                              Pagado
                            </span>
                            <div className="text-[11px] text-brand-400 mt-1">
                              {p.pagado_por_nombre ?? "—"} · {fechaCorta(p.pagado_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => marcar(p.periodo, pagado ? "PENDIENTE" : "PAGADO")}
                          disabled={marcando === p.periodo}
                          className={
                            pagado
                              ? "text-xs font-medium text-brand-400 hover:text-brand-700 transition disabled:opacity-50"
                              : "rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition disabled:opacity-50"
                          }
                        >
                          {marcando === p.periodo
                            ? "…"
                            : pagado
                              ? "Revertir"
                              : "Marcar pagado"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="rounded-xl bg-brand-50 border border-brand-100 px-5 py-3 text-right">
              <div className="text-[11px] uppercase tracking-widest text-brand-400 font-medium">
                Pendiente de pago
              </div>
              <div className="font-display font-extrabold text-2xl text-brand-900 tabular-nums">
                {mxn(pendiente)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
