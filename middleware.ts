import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// getUser() llama por red al Auth de Supabase. Si ese servicio se pone lento o
// no responde, el middleware Edge se queda colgado hasta que Vercel lo mata con
// MIDDLEWARE_INVOCATION_TIMEOUT (504) para el usuario. Acotamos esa llamada.
const AUTH_TIMEOUT_MS = 3000;

// Devuelve el valor de la promesa, o null si tarda mas de `ms` o falla.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow the cron endpoint to be invoked with a secret header (not browser).
  if (pathname.startsWith("/api/copeland/cron")) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  // getUser() valida el token contra Supabase Auth por red y, de paso, refresca
  // la cookie de sesion. Lo acotamos con un timeout: si no resuelve a tiempo
  // dejamos pasar el request (fail-open). La proteccion real de las paginas la
  // sigue haciendo app/(app)/layout.tsx, que revalida getUser() en el servidor.
  const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
  const authResolved = result !== null;
  const user = result?.data?.user ?? null;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Solo redirigimos a /login cuando confirmamos que NO hay usuario. Si la
  // consulta de auth expiro (authResolved === false) dejamos pasar en vez de
  // rebotar a login una sesion que podria ser valida.
  if (authResolved && !user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (authResolved && user && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
