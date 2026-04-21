import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { LeafLogo } from "@/components/brand/LeafLogo";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-900 via-brand-800 to-emerald-700 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <LeafLogo className="w-10 h-10 text-brand-900" />
          <div>
            <div className="text-xl font-bold tracking-tight text-brand-900">AgroTrack</div>
            <div className="text-xs text-slate-500">Gestión logística agrónoma</div>
          </div>
        </div>
        <Suspense fallback={<div className="text-sm text-slate-500">Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
