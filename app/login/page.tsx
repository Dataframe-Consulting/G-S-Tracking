import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { LeafLogo } from "@/components/brand/LeafLogo";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-6">
      <div className="w-full max-w-md rounded-2xl bg-brand-50 shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <LeafLogo className="w-11 h-11 text-brand-900" />
          <div>
            <div className="font-display font-extrabold text-xl tracking-widest text-brand-900">
              AGROTRACK
            </div>
            <div className="text-[11px] tracking-widest uppercase text-brand-500">
              Agriculture Logistics
            </div>
          </div>
        </div>
        <Suspense fallback={<div className="text-sm text-brand-500">Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
