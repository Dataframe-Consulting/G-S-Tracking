"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { formatFecha as fmt } from "@/lib/fecha";

interface Props {
  /** Fecha inicial del rango en formato AAAA-MM-DD ("" si vacío) */
  desde: string;
  /** Fecha final del rango en formato AAAA-MM-DD ("" si vacío) */
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
}

/** Date → "AAAA-MM-DD" usando la fecha local (sin desfase de zona horaria) */
function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "AAAA-MM-DD" → Date local (o undefined si vacío) */
function fromStr(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateRangePicker({ desde, hasta, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const range: DateRange | undefined = desde
    ? { from: fromStr(desde), to: fromStr(hasta) }
    : undefined;

  const hasValue = Boolean(desde || hasta);

  let label = "Fecha";
  if (desde && hasta) label = `${fmt(desde)} – ${fmt(hasta)}`;
  else if (desde) label = `Desde ${fmt(desde)}`;
  else if (hasta) label = `Hasta ${fmt(hasta)}`;

  function handleSelect(r: DateRange | undefined) {
    onChange(r?.from ? toStr(r.from) : "", r?.to ? toStr(r.to) : "");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition ${
          hasValue
            ? "border-brand-400 text-brand-900 font-medium"
            : "border-brand-200 text-brand-400"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {label}
        {hasValue && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
            }}
            className="ml-1 text-brand-400 hover:text-brand-700"
            aria-label="Limpiar fechas"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 rounded-xl border border-brand-200 bg-white p-2 shadow-lg">
          <DayPicker
            mode="range"
            locale={es}
            selected={range}
            onSelect={handleSelect}
            numberOfMonths={1}
            style={{
              ["--rdp-accent-color" as string]: "#316644",
              ["--rdp-accent-background-color" as string]: "#e0ebe3",
            }}
          />
        </div>
      )}
    </div>
  );
}
