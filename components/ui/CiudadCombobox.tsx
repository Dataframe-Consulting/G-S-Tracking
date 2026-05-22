"use client";

import { useState, useRef, useEffect } from "react";
import { CIUDADES_MEXICO } from "@/lib/ciudades-mexico";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Clases aplicadas al <input> */
  inputClassName?: string;
  /** Clases aplicadas al div contenedor (para márgenes externos) */
  className?: string;
}

export function CiudadCombobox({
  value,
  onChange,
  placeholder = "Ciudad",
  required,
  inputClassName = "",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered =
    value.length === 0
      ? []
      : CIUDADES_MEXICO.filter((c) =>
          c.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 9);

  useEffect(() => {
    setHighlighted(0);
  }, [value]);

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

  function select(city: string) {
    onChange(city);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        spellCheck={false}
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-brand-200 bg-white py-1 shadow-lg">
          {filtered.map((city, i) => (
            <li
              key={city}
              onMouseDown={(e) => {
                e.preventDefault();
                select(city);
              }}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                i === highlighted
                  ? "bg-brand-50 font-medium text-brand-900"
                  : "text-brand-700 hover:bg-brand-50"
              }`}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
