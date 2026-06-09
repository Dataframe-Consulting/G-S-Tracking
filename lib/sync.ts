import type { SupabaseClient } from "@supabase/supabase-js";
import { getSensorReadings, simulateDeviceReadings } from "./copeland";
import type { CopelandReading } from "./copeland";
import { checkAlertas } from "./alertas";
import { viajeConcluido } from "./viaje";
import type { Status } from "./types";

type ViajeRow = {
  id: string;
  termografo_ids: string[];
  alerta_activa: boolean;
  ordenes_venta: Array<{
    status: Status;
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

type DeviceReadings = { termografoId: string; readings: CopelandReading[] };

async function persistMultipleReadings(
  supabase: SupabaseClient,
  viaje: ViajeRow,
  devices: DeviceReadings[],
  productTempMin: number | undefined,
  productTempMax: number | undefined
) {
  const rows = devices.flatMap(({ termografoId, readings }) =>
    readings.map((r) => ({
      viaje_id: viaje.id,
      termografo_id: termografoId,
      temperatura: r.temperature,
      lat: r.latitude,
      lng: r.longitude,
      timestamp: r.timestamp,
      fuera_rango:
        productTempMin != null &&
        productTempMax != null &&
        (r.temperature < productTempMin || r.temperature > productTempMax),
    }))
  );

  // Dedup: no reinsertar lecturas que ya existen (mismo termógrafo + timestamp).
  // Importante para el backfill y para "Sincronizar ahora", que reescanean el stream.
  if (rows.length > 0) {
    const termIds = [...new Set(rows.map((r) => r.termografo_id))];
    const times = rows.map((r) => new Date(r.timestamp).getTime());
    const minISO = new Date(Math.min(...times)).toISOString();
    const maxISO = new Date(Math.max(...times)).toISOString();
    const { data: existentes } = await supabase
      .from("lecturas_temperatura")
      .select("termografo_id, timestamp")
      .eq("viaje_id", viaje.id)
      .in("termografo_id", termIds)
      .gte("timestamp", minISO)
      .lte("timestamp", maxISO);
    const vistos = new Set(
      (existentes ?? []).map((e) => `${e.termografo_id}|${new Date(e.timestamp).getTime()}`)
    );
    const nuevas = rows.filter(
      (r) => !vistos.has(`${r.termografo_id}|${new Date(r.timestamp).getTime()}`)
    );
    if (nuevas.length > 0) {
      await supabase.from("lecturas_temperatura").insert(nuevas);
    }
  }

  // Average of each device's latest reading
  const latestTemps = devices.map(({ readings }) => readings.at(-1)!.temperature);
  const avgTemp = latestTemps.reduce((a, b) => a + b, 0) / latestTemps.length;

  // Most recent reading across all devices (for lat/lng/timestamp)
  const allReadings = devices.flatMap((d) => d.readings);
  const latest = allReadings.reduce((a, b) =>
    new Date(a.timestamp) > new Date(b.timestamp) ? a : b
  );

  await Promise.all([
    supabase
      .from("viajes")
      .update({
        temp_actual: avgTemp,
        lat: latest.latitude,
        lng: latest.longitude,
        ultima_lectura: latest.timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", viaje.id),
    ...devices.map(({ termografoId, readings }) =>
      supabase
        .from("termografos")
        .update({ ultima_actividad: readings.at(-1)!.timestamp })
        .eq("id", termografoId)
    ),
  ]);
}

async function loadViajes(
  supabase: SupabaseClient,
  viajeId?: string | null
): Promise<ViajeRow[]> {
  let q = supabase
    .from("termografos")
    .select(`id, viaje_id, viajes!inner(id, alerta_activa, ordenes_venta(status, produto:productos(temp_min, temp_max)))`)
    .eq("asignado", true);

  if (viajeId) q = q.eq("viaje_id", viajeId);

  const { data, error } = await q;
  if (error || !data) return [];

  type RawRow = {
    id: string;
    viaje_id: string;
    viajes: unknown;
  };

  // Group by viaje_id → ViajeRow
  const map = new Map<string, ViajeRow>();
  for (const t of (data as unknown as RawRow[])) {
    if (!t.viaje_id) continue;
    const viajeRaw = (Array.isArray(t.viajes) ? t.viajes[0] : t.viajes) as {
      id: string;
      alerta_activa: boolean;
      ordenes_venta: ViajeRow["ordenes_venta"];
    } | null;
    if (!viajeRaw) continue;
    const existing = map.get(t.viaje_id);
    if (existing) {
      existing.termografo_ids.push(t.id);
    } else {
      map.set(t.viaje_id, {
        id: t.viaje_id,
        termografo_ids: [t.id],
        alerta_activa: !!viajeRaw.alerta_activa,
        ordenes_venta: viajeRaw.ordenes_venta ?? [],
      });
    }
  }
  return Array.from(map.values());
}

export async function runSync(supabase: SupabaseClient, viajeId?: string | null) {
  const todos = await loadViajes(supabase, viajeId);
  if (todos.length === 0) return { updated: 0 };

  // Candado: un viaje con TODAS sus OVs en Entregado se considera concluido →
  // se congela (no se registran lecturas nuevas ni se evalúan alertas).
  const concluidos = todos.filter((v) => viajeConcluido(v.ordenes_venta));
  const activos = todos.filter((v) => !viajeConcluido(v.ordenes_venta));

  // Al concluir, limpiar la alerta que hubiera quedado activa (solo los que aún
  // la tengan encendida, para no escribir de más en cada corrida).
  const limpiarAlerta = concluidos.filter((v) => v.alerta_activa).map((v) => v.id);
  if (limpiarAlerta.length > 0) {
    await supabase
      .from("viajes")
      .update({ alerta_activa: false, updated_at: new Date().toISOString() })
      .in("id", limpiarAlerta);
  }

  if (activos.length === 0) {
    return { updated: 0, congelados: concluidos.length };
  }

  const simulate = process.env.COPELAND_SIMULATE !== "false";

  const res = simulate
    ? await runSimSync(supabase, activos)
    : await runRealSync(supabase, activos, viajeId ?? null);

  return { ...res, congelados: concluidos.length };
}

// ---------------------------------------------------------------------------
// Modo simulación: genera datos por dispositivo
// ---------------------------------------------------------------------------
async function runSimSync(supabase: SupabaseClient, viajes: ViajeRow[]) {
  let updated = 0;
  const alertResults: unknown[] = [];

  for (const viaje of viajes) {
    const { productTempMin, productTempMax } = getTempRange(viaje);

    const devices: DeviceReadings[] = [];
    for (const termografoId of viaje.termografo_ids) {
      const readings = simulateDeviceReadings(termografoId, { productTempMin, productTempMax });
      if (readings.length > 0) devices.push({ termografoId, readings });
    }

    if (devices.length === 0) continue;

    await persistMultipleReadings(supabase, viaje, devices, productTempMin, productTempMax);
    const res = await checkAlertas(supabase, viaje.id, productTempMin, productTempMax);
    alertResults.push(res);
    updated++;
  }

  return { updated, alertas: alertResults, copeland: { mode: "sim" } };
}

// ---------------------------------------------------------------------------
// Modo real: GetSensorReadings global → filtrar por trackers activos
// ---------------------------------------------------------------------------
async function runRealSync(
  supabase: SupabaseClient,
  viajes: ViajeRow[],
  filterViajeId: string | null
) {
  // Map trackerId → viaje
  const trackerMap = new Map<string, ViajeRow>();
  for (const v of viajes) {
    for (const tid of v.termografo_ids) {
      trackerMap.set(tid, v);
    }
  }

  let cursor: string | null = null;
  if (!filterViajeId) {
    const { data } = await supabase
      .from("config")
      .select("value")
      .eq("key", "copeland_sync_state")
      .single();
    cursor = (data?.value as { last_guid?: string } | null)?.last_guid ?? null;
  }

  // Group readings by viaje → device
  const byViaje = new Map<string, Map<string, CopelandReading[]>>();
  const rawPages: unknown[] = [];
  let newCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const result = await getSensorReadings(newCursor);
    rawPages.push(result.raw);

    for (const r of result.readings) {
      const viaje = trackerMap.get(r.device_id);
      if (!viaje) continue;
      const deviceMap = byViaje.get(viaje.id) ?? new Map<string, CopelandReading[]>();
      const deviceReadings = deviceMap.get(r.device_id) ?? [];
      deviceReadings.push(r);
      deviceMap.set(r.device_id, deviceReadings);
      byViaje.set(viaje.id, deviceMap);
    }

    if (result.maxGuid) newCursor = result.maxGuid;
    hasMore = result.hasMore && result.readings.length > 0;
  }

  let updated = 0;
  const alertResults: unknown[] = [];

  for (const [vid, deviceMap] of byViaje.entries()) {
    const viaje = viajes.find((v) => v.id === vid)!;
    const { productTempMin, productTempMax } = getTempRange(viaje);

    const devices: DeviceReadings[] = Array.from(deviceMap.entries()).map(
      ([termografoId, readings]) => ({ termografoId, readings })
    );

    await persistMultipleReadings(supabase, viaje, devices, productTempMin, productTempMax);
    const res = await checkAlertas(supabase, vid, productTempMin, productTempMax);
    alertResults.push(res);
    updated++;
  }

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

  return {
    updated,
    alertas: alertResults,
    copeland: {
      mode: "real",
      pages: rawPages.length,
      cursor_before: cursor,
      cursor_after: newCursor,
      responses: rawPages,
    },
  };
}
