import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  AlertaLog,
  Auditoria,
  LecturaTemperatura,
  PuntoRecorrido,
  Termografo,
  Viaje,
} from "@/lib/types";
import { ViajeDetail } from "@/components/Viajes/ViajeDetail";

export const dynamic = "force-dynamic";

export default async function ViajeDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: viaje } = await supabase
    .from("viajes")
    .select(`*, responsable:user_profiles!responsable_id(id, nombre, email), linea:lineas_transportista!linea_transportista_id ( id, nombre, concesionario:concesionarios!concesionario_id ( id, nombre ) ), ordenes_venta ( *, productos:orden_productos(id, producto_id, cajas, producto:productos(id, nombre)) )`)
    .eq("id", params.id)
    .maybeSingle();

  if (!viaje) notFound();

  // Rol del usuario para gatear acciones sensibles (ej. eliminar viaje).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("user_profiles").select("role").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const role = (profile?.role as string) ?? "master";

  const [
    { data: lecturas },
    { data: recorrido },
    { data: alertas },
    { data: termografos },
    { data: auditoria },
  ] = await Promise.all([
    // Últimas lecturas: alimentan la gráfica de temperatura, el gauge y la
    // tabla "Últimas lecturas". 150 es suficiente para esos tres.
    supabase
      .from("lecturas_temperatura")
      .select("*")
      .eq("viaje_id", params.id)
      .order("timestamp", { ascending: false })
      .limit(150),
    // Recorrido COMPLETO para el mapa. Antes la polilínea se dibujaba con las
    // mismas 150 lecturas de arriba, que en un viaje con 2 termógrafos son
    // ~7 h de ruta: el tramo inicial desaparecía y el mapa parecía mostrar un
    // viaje más corto del que era. Va en query aparte y solo con las columnas
    // que el mapa necesita, para no inflar el payload (~84 KB por cada 600
    // puntos). El tope de 5000 es un techo de seguridad que un viaje normal no
    // alcanza; va en orden descendente y se invierte abajo para que, si algún
    // día se topara, lo que se pierda sea el tramo más viejo y no el reciente.
    supabase
      .from("lecturas_temperatura")
      .select("id, termografo_id, lat, lng, timestamp")
      .eq("viaje_id", params.id)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("timestamp", { ascending: false })
      .limit(5000),
    supabase
      .from("alertas_log")
      .select("*")
      .eq("viaje_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20),
    // El .order es necesario: sin ORDER BY Postgres puede devolver los
    // termógrafos en cualquier orden, y de ese orden dependen el carrusel de
    // Monitoreo y la ruta que dibuja el mapa. Sin él, recargar la página
    // podía cambiar cuál sale primero.
    supabase
      .from("termografos")
      .select("*")
      .eq("viaje_id", params.id)
      .eq("asignado", true)
      .order("id", { ascending: true }),
    supabase
      .from("auditoria")
      .select("*")
      .eq("viaje_id", params.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/viajes" className="text-sm text-slate-500 hover:text-slate-700">
        ← Viajes
      </Link>
      <ViajeDetail
        viaje={viaje as Viaje}
        lecturas={(lecturas ?? []) as LecturaTemperatura[]}
        recorrido={((recorrido ?? []) as PuntoRecorrido[]).slice().reverse()}
        alertas={(alertas ?? []) as AlertaLog[]}
        termografos={(termografos ?? []) as Termografo[]}
        auditoria={(auditoria ?? []) as Auditoria[]}
        role={role}
      />
    </div>
  );
}
