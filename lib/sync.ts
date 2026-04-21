import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeviceReadings } from "./copeland";
import { checkAlertas } from "./alertas";

export async function runSync(supabase: SupabaseClient, cargaId?: string | null) {
  let q = supabase
    .from("cargas")
    .select(`id, termografo_id, status, producto:productos ( temp_min, temp_max )`)
    .not("termografo_id", "is", null);

  if (cargaId) {
    q = q.eq("id", cargaId);
  } else {
    q = q.eq("status", "TRANSITO");
  }

  const { data: cargas, error } = await q;
  if (error) return { error: error.message, updated: 0 };
  if (!cargas || cargas.length === 0) return { updated: 0 };

  let updated = 0;
  const alertResults: unknown[] = [];

  for (const carga of cargas) {
    const producto = Array.isArray(carga.producto) ? carga.producto[0] : carga.producto;
    const readings = await getDeviceReadings(carga.termografo_id!, {
      productTempMin: producto?.temp_min,
      productTempMax: producto?.temp_max
    });
    if (readings.length === 0) continue;

    const rows = readings.map((r) => {
      const out =
        producto &&
        (Number(r.temperature) < Number(producto.temp_min) ||
          Number(r.temperature) > Number(producto.temp_max));
      return {
        carga_id: carga.id,
        termografo_id: r.device_id,
        temperatura: r.temperature,
        lat: r.latitude,
        lng: r.longitude,
        timestamp: r.timestamp,
        fuera_rango: !!out
      };
    });

    await supabase.from("lecturas_temperatura").insert(rows);

    const latest = readings[readings.length - 1];
    await supabase
      .from("cargas")
      .update({
        temp_actual: latest.temperature,
        lat: latest.latitude,
        lng: latest.longitude,
        ultima_lectura: latest.timestamp,
        updated_at: new Date().toISOString()
      })
      .eq("id", carga.id);

    await supabase
      .from("termografos")
      .update({ ultima_actividad: latest.timestamp })
      .eq("id", carga.termografo_id!);

    const res = await checkAlertas(supabase, carga.id);
    alertResults.push(res);
    updated++;
  }

  return { updated, alertas: alertResults };
}
