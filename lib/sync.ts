import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeviceReadings } from "./copeland";
import { checkAlertas } from "./alertas";

export async function runSync(supabase: SupabaseClient, viajeId?: string | null) {
  let q = supabase
    .from("viajes")
    .select(`id, termografo_id, ordenes_venta ( producto:productos ( temp_min, temp_max ) )`)
    .not("termografo_id", "is", null);

  if (viajeId) {
    q = q.eq("id", viajeId);
  }

  const { data: viajes, error } = await q;
  if (error) return { error: error.message, updated: 0 };
  if (!viajes || viajes.length === 0) return { updated: 0 };

  let updated = 0;
  const alertResults: unknown[] = [];

  for (const viaje of viajes) {
    // Use the most restrictive temp range across all OVs in this viaje
    const allOrdenes = Array.isArray(viaje.ordenes_venta) ? viaje.ordenes_venta : [];
    const productos = allOrdenes
      .map((o: { producto: { temp_min: number; temp_max: number } | null }) =>
        Array.isArray(o.producto) ? o.producto[0] : o.producto
      )
      .filter(Boolean);

    const productTempMin =
      productos.length > 0 ? Math.max(...productos.map((p: { temp_min: number }) => Number(p.temp_min))) : undefined;
    const productTempMax =
      productos.length > 0 ? Math.min(...productos.map((p: { temp_max: number }) => Number(p.temp_max))) : undefined;

    const readings = await getDeviceReadings(viaje.termografo_id!, {
      productTempMin,
      productTempMax,
    });
    if (readings.length === 0) continue;

    const rows = readings.map((r) => {
      const out =
        productTempMin != null &&
        productTempMax != null &&
        (Number(r.temperature) < productTempMin || Number(r.temperature) > productTempMax);
      return {
        viaje_id: viaje.id,
        termografo_id: r.device_id,
        temperatura: r.temperature,
        lat: r.latitude,
        lng: r.longitude,
        timestamp: r.timestamp,
        fuera_rango: !!out,
      };
    });

    await supabase.from("lecturas_temperatura").insert(rows);

    const latest = readings[readings.length - 1];
    await supabase
      .from("viajes")
      .update({
        temp_actual: latest.temperature,
        lat: latest.latitude,
        lng: latest.longitude,
        ultima_lectura: latest.timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viaje.id);

    await supabase
      .from("termografos")
      .update({ ultima_actividad: latest.timestamp })
      .eq("id", viaje.termografo_id!);

    const res = await checkAlertas(supabase, viaje.id, productTempMin, productTempMax);
    alertResults.push(res);
    updated++;
  }

  return { updated, alertas: alertResults };
}
