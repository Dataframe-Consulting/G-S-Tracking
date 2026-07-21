import type { SupabaseClient } from "@supabase/supabase-js";
import { getSensorReadings, simulateDeviceReadings } from "./copeland";
import type { CopelandReading } from "./copeland";
import { checkAlertas } from "./alertas";
import { viajeConcluido } from "./viaje";
import { resolveUbicacion } from "./geocode";
import type { Status } from "./types";

type ViajeRow = {
  id: string;
  numero: number;
  termografo_ids: string[];
  alerta_activa: boolean;
  temp_min: number | null;
  temp_max: number | null;
  temp_actual: number | null;
  ordenes_venta: Array<{ status: Status }>;
};

// Rango efectivo del viaje: SOLO el rango propio del viaje (manual o de catálogo).
// Los productos ya no tienen temperatura (Fase 4): si el viaje no tiene rango,
// no hay rango → no se evalúan alertas hasta que el operador lo asigne.
function getTempRange(viaje: ViajeRow) {
  if (viaje.temp_min != null && viaje.temp_max != null) {
    return { productTempMin: Number(viaje.temp_min), productTempMax: Number(viaje.temp_max) };
  }
  return { productTempMin: undefined, productTempMax: undefined };
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

  // Geocodificar la última posición a Ciudad/Estado/País (con caché compartido,
  // sin tocar el proveedor si la zona ya se resolvió antes). Fail-safe: si falla,
  // deja la ubicación previa intacta (no la sobrescribe con nulls).
  let ubicacion: Awaited<ReturnType<typeof resolveUbicacion>> | null = null;
  if (latest.latitude != null && latest.longitude != null) {
    ubicacion = await resolveUbicacion(supabase, latest.latitude, latest.longitude);
  }

  const viajeUpdate: Record<string, unknown> = {
    temp_actual: avgTemp,
    lat: latest.latitude,
    lng: latest.longitude,
    ultima_lectura: latest.timestamp,
    updated_at: new Date().toISOString(),
  };
  if (ubicacion && (ubicacion.ciudad || ubicacion.estado || ubicacion.pais)) {
    viajeUpdate.ubicacion_ciudad = ubicacion.ciudad;
    viajeUpdate.ubicacion_estado = ubicacion.estado;
    viajeUpdate.ubicacion_pais = ubicacion.pais;
    viajeUpdate.ubicacion_geo_key = ubicacion.geo_key;
  }

  await Promise.all([
    supabase
      .from("viajes")
      .update(viajeUpdate)
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
  // Solo termógrafos asignados Y no deshabilitados. Un termógrafo deshabilitado
  // (Cambio 1) conserva su vínculo con el viaje (asignado + viaje_id intactos y su
  // historial de lecturas) pero deja de pedir lecturas nuevas y de contar en
  // promedio/alertas. La columna es NOT NULL default false, así que .eq es seguro.
  let q = supabase
    .from("termografos")
    .select(`id, viaje_id, viajes!inner(id, numero, alerta_activa, temp_min, temp_max, temp_actual, ordenes_venta(status))`)
    .eq("asignado", true)
    .eq("deshabilitado", false);

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
      numero: number;
      alerta_activa: boolean;
      temp_min: number | null;
      temp_max: number | null;
      temp_actual: number | null;
      ordenes_venta: ViajeRow["ordenes_venta"];
    } | null;
    if (!viajeRaw) continue;
    const existing = map.get(t.viaje_id);
    if (existing) {
      existing.termografo_ids.push(t.id);
    } else {
      map.set(t.viaje_id, {
        id: t.viaje_id,
        numero: viajeRaw.numero,
        termografo_ids: [t.id],
        alerta_activa: !!viajeRaw.alerta_activa,
        temp_min: viajeRaw.temp_min,
        temp_max: viajeRaw.temp_max,
        temp_actual: viajeRaw.temp_actual,
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

  try {
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
  } catch (err) {
    // Copeland cayó / rate-limit a mitad de la paginación (típico: la 2ª página de la
    // ráfaga se corta con un error no-fatal no contemplado). NO descartamos el progreso:
    // conservamos las lecturas ya recolectadas de las páginas exitosas y el `newCursor`
    // avanzado hasta la última de ellas, para que ESTA corrida persista ese avance y la
    // siguiente continúe desde ahí. Descartar y resetear el cursor (comportamiento
    // anterior) dejaba el sync clavado releyendo la misma primera página para siempre,
    // sin alcanzar nunca las lecturas nuevas. El dedup en persistMultipleReadings hace
    // seguro guardar páginas parciales. Simplemente cortamos el loop con lo que llevamos.
    console.warn("Copeland getSensorReadings falló, se conserva el progreso parcial:", err);
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

  // Evaluar alertas para viajes sin lecturas nuevas en esta corrida
  for (const viaje of viajes) {
    if (byViaje.has(viaje.id)) continue; // ya se procesó arriba
    const { productTempMin, productTempMax } = getTempRange(viaje);
    if (productTempMin == null || productTempMax == null) continue; // sin rango, skip
    const res = await checkAlertas(supabase, viaje.id, productTempMin, productTempMax);
    alertResults.push(res);
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
