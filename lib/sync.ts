import type { SupabaseClient } from "@supabase/supabase-js";
import { getSensorReadings, simulateDeviceReadings } from "./copeland";
import type { CopelandReading } from "./copeland";
import { checkAlertas } from "./alertas";

type ViajeRow = {
  id: string;
  termografo_id: string;
  ordenes_venta: Array<{
    produto: { temp_min: number; temp_max: number } | null;
  }>;
};

function getTempRange(viaje: ViajeRow) {
  const productos = viaje.ordenes_venta
    .map((o) => (Array.isArray(o.produto) ? o.produto[0] : o.produto))
    .filter(Boolean) as Array<{ temp_min: number; temp_max: number }>;

  return {
    productTempMin:
      productos.length > 0
        ? Math.max(...productos.map((p) => Number(p.temp_min)))
        : undefined,
    productTempMax:
      productos.length > 0
        ? Math.min(...productos.map((p) => Number(p.temp_max)))
        : undefined,
  };
}

async function persistReadings(
  supabase: SupabaseClient,
  viaje: ViajeRow,
  readings: CopelandReading[],
  productTempMin: number | undefined,
  productTempMax: number | undefined
) {
  const rows = readings.map((r) => ({
    viaje_id: viaje.id,
    termografo_id: r.device_id,
    temperatura: r.temperature,
    lat: r.latitude,
    lng: r.longitude,
    timestamp: r.timestamp,
    fuera_rango:
      productTempMin != null &&
      productTempMax != null &&
      (r.temperature < productTempMin || r.temperature > productTempMax),
  }));

  await supabase.from("lecturas_temperatura").insert(rows);

  const latest = readings.at(-1)!;
  await Promise.all([
    supabase
      .from("viajes")
      .update({
        temp_actual: latest.temperature,
        lat: latest.latitude,
        lng: latest.longitude,
        ultima_lectura: latest.timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viaje.id),
    supabase
      .from("termografos")
      .update({ ultima_actividad: latest.timestamp })
      .eq("id", viaje.termografo_id),
  ]);
}

export async function runSync(supabase: SupabaseClient, viajeId?: string | null) {
  let q = supabase
    .from("viajes")
    .select(`id, termografo_id, ordenes_venta ( produto:produtos ( temp_min, temp_max ) )`)
    .not("termografo_id", "is", null);

  if (viajeId) q = q.eq("id", viajeId);

  const { data: viajes, error } = await q;
  if (error) return { error: error.message, updated: 0 };
  if (!viajes || viajes.length === 0) return { updated: 0 };

  const simulate = process.env.COPELAND_SIMULATE !== "false";

  if (simulate) {
    return runSimSync(supabase, viajes as ViajeRow[]);
  }
  return runRealSync(supabase, viajes as ViajeRow[], viajeId ?? null);
}

// ---------------------------------------------------------------------------
// Modo simulación: genera datos por dispositivo
// ---------------------------------------------------------------------------
async function runSimSync(supabase: SupabaseClient, viajes: ViajeRow[]) {
  let updated = 0;
  const alertResults: unknown[] = [];

  for (const viaje of viajes) {
    const { productTempMin, productTempMax } = getTempRange(viaje);
    const readings = simulateDeviceReadings(viaje.termografo_id, { productTempMin, productTempMax });
    if (readings.length === 0) continue;

    await persistReadings(supabase, viaje, readings, productTempMin, productTempMax);
    const res = await checkAlertas(supabase, viaje.id, productTempMin, productTempMax);
    alertResults.push(res);
    updated++;
  }

  return { updated, alertas: alertResults };
}

// ---------------------------------------------------------------------------
// Modo real: GetSensorReadings global → filtrar por trackers activos
// ---------------------------------------------------------------------------
async function runRealSync(
  supabase: SupabaseClient,
  viajes: ViajeRow[],
  filterViajeId: string | null
) {
  // Mapa trackerId → viaje para lookup rápido
  const trackerMap = new Map<string, ViajeRow>();
  for (const v of viajes) trackerMap.set(v.termografo_id, v);

  // Cargar cursor global (sólo en sync global, no por viaje)
  let cursor: string | null = null;
  if (!filterViajeId) {
    const { data } = await supabase
      .from("config")
      .select("value")
      .eq("key", "copeland_sync_state")
      .single();
    cursor = (data?.value as { last_guid?: string } | null)?.last_guid ?? null;
  }

  // Agrupar lecturas por viaje drenando todas las páginas
  const byViaje = new Map<string, CopelandReading[]>();
  let newCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const result = await getSensorReadings(newCursor);

    for (const r of result.readings) {
      const viaje = trackerMap.get(r.device_id);
      if (!viaje) continue;
      const list = byViaje.get(viaje.id) ?? [];
      list.push(r);
      byViaje.set(viaje.id, list);
    }

    if (result.maxGuid) newCursor = result.maxGuid;
    // Parar si no hay más páginas o si la página vino vacía
    hasMore = result.hasMore && result.readings.length > 0;
  }

  let updated = 0;
  const alertResults: unknown[] = [];

  for (const [vid, readings] of byViaje.entries()) {
    const viaje = viajes.find((v) => v.id === vid)!;
    const { productTempMin, productTempMax } = getTempRange(viaje);

    await persistReadings(supabase, viaje, readings, productTempMin, productTempMax);
    const res = await checkAlertas(supabase, vid, productTempMin, productTempMax);
    alertResults.push(res);
    updated++;
  }

  // Avanzar cursor global (sólo sync global)
  if (!filterViajeId && newCursor && newCursor !== cursor) {
    await supabase.from("config").upsert(
      {
        key: "copeland_sync_state",
        value: { last_guid: newCursor },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  }

  return { updated, alertas: alertResults };
}
