"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

export function LogoEmpresa({
  logoUrl: initial,
  isMaster,
}: {
  logoUrl: string | null;
  isMaster: boolean;
}) {
  const [logoUrl, setLogoUrl] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append("logo", file);

    const res = await fetch("/api/empresa/logo", { method: "POST", body: form });
    const json = await res.json();
    setUploading(false);

    if (!res.ok) {
      toast.error(json.error || "Error al subir el logo");
    } else {
      setLogoUrl(json.logo_url);
      toast.success("Logo actualizado");
    }

    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative w-32 h-20 rounded-xl border bg-white flex items-center justify-center overflow-hidden shadow-sm group ${
          isMaster ? "border-brand-200 cursor-pointer" : "border-brand-100"
        }`}
        onClick={() => isMaster && !uploading && inputRef.current?.click()}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo empresa"
            fill
            unoptimized
            className="object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-brand-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-[10px] font-medium uppercase tracking-wider">Logo</span>
          </div>
        )}

        {/* Master hover overlay */}
        {isMaster && (
          <div className="absolute inset-0 bg-brand-900/50 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className="text-white text-[10px] font-semibold uppercase tracking-wider">
                  {logoUrl ? "Cambiar" : "Subir"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {isMaster && (
        <span className="text-[10px] text-brand-400">
          {uploading ? "Subiendo…" : "Click para cambiar"}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
