"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { formatFecha } from "@/lib/fecha";

interface Props {
  /** Valor en formato AAAA-MM-DD ("" si vacío) */
  value: string;
  onChange: (val: string) => void;
  /** Clases para el botón disparador (para igualar el resto de campos) */
  className?: string;
  placeholder?: string;
  /** Si es obligatorio: no permite limpiar ni deseleccionar */
  required?: boolean;
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

export function DatePicker({
  value,
  onChange,
  className = "",
  placeholder = "dd/mm/aaaa",
  required = false,
}: Props) {
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

  const selected = fromStr(value);

  function handleSelect(d: Date | undefined) {
    onChange(d ? toStr(d) : "");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={value ? "" : "text-brand-300"}>
          {value ? formatFecha(value) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {!required && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpiar fecha"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-brand-400 hover:text-brand-700"
            >
              ✕
            </span>
          )}
          <svg className="w-4 h-4 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 rounded-xl border border-brand-200 bg-white p-2 shadow-lg">
          <DayPicker
            mode="single"
            required={required}
            locale={es}
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
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
