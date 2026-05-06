/**
 * Copeland EDI API v2 client.
 * Docs: CopelandEDIAPIv2_Documentation.md
 *
 * Base URL: https://api.oversight.copeland.com/edi
 * Auth headers: X-LT-ApiKey + Ocp-Apim-Subscription-Key
 *
 * MODO REAL  (COPELAND_SIMULATE=false):
 *   - defineTrip  → POST /edi/DefineTrip   al asignar termógrafo
 *   - closeTrip   → POST /edi/CloseTrip    al quitar termógrafo
 *   - getSensorReadings → POST /edi/GetSensorReadings (global, paginado)
 *
 * MODO SIM   (COPELAND_SIMULATE=true, default):
 *   - defineTrip / closeTrip son no-ops
 *   - simulateDeviceReadings genera datos por dispositivo
 */

const BASE_URL = "https://api.oversight.copeland.com/edi";

export interface CopelandReading {
  device_id: string;
  temperature: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  battery: number;
  guid?: string;
}

function copelandHeaders(): HeadersInit {
  const apiKey = process.env.COPELAND_API_KEY;
  const subKey = process.env.COPELAND_SUBSCRIPTION_KEY;
  if (!apiKey || !subKey) {
    throw new Error("COPELAND_API_KEY / COPELAND_SUBSCRIPTION_KEY no configurados en .env");
  }
  return {
    "Content-Type": "application/json",
    "X-LT-ApiKey": apiKey,
    "Ocp-Apim-Subscription-Key": subKey,
  };
}

// ---------------------------------------------------------------------------
// Trip lifecycle
// ---------------------------------------------------------------------------

export interface DefineTripParams {
  tripId: string;            // Usamos el viaje UUID como TripID en Copeland
  trackerId: string;         // Número de serie del dispositivo Copeland
  originName: string;        // lugar_inicio del viaje
  destinationName: string;   // lugar_fin del viaje
  scheduledStartUTC?: string | null;
  scheduledEndUTC?: string | null;
  tempLowCritical?: number | null;
  tempHighCritical?: number | null;
}

export async function defineTrip(
  params: DefineTripParams
): Promise<{ success: boolean; error?: string }> {
  if (process.env.COPELAND_SIMULATE !== "false") return { success: true };

  const body = {
    TripID: params.tripId,
    TrackerID: params.trackerId,
    TempLowCritical: params.tempLowCritical ?? null,
    TempHighCritical: params.tempHighCritical ?? null,
    Locations: [
      {
        LocationName: params.originName.slice(0, 50),
        LocationID: "ORIG",
        Address1: params.originName.slice(0, 100),
        City: params.originName.slice(0, 50),
        Zip: "00000",
        Country: "MX",
        LocationType: 0, // pick
        StopDateUTC: params.scheduledStartUTC ?? null,
        StopTypeCode: null,
      },
      {
        LocationName: params.destinationName.slice(0, 50),
        LocationID: "DEST",
        Address1: params.destinationName.slice(0, 100),
        City: params.destinationName.slice(0, 50),
        Zip: "00000",
        Country: "MX",
        LocationType: 1, // delivery
        StopDateUTC: params.scheduledEndUTC ?? null,
        StopTypeCode: null,
      },
    ],
  };

  try {
    const res = await fetch(`${BASE_URL}/DefineTrip`, {
      method: "POST",
      headers: copelandHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json();
    if (data.ErrorCode !== 0) {
      return { success: false, error: data.ErrorDescription ?? `ErrorCode ${data.ErrorCode}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function closeTrip(tripId: string, trackerId: string): Promise<void> {
  if (process.env.COPELAND_SIMULATE !== "false") return;
  try {
    await fetch(`${BASE_URL}/CloseTrip`, {
      method: "POST",
      headers: copelandHeaders(),
      body: JSON.stringify({ TripID: tripId, TrackerID: trackerId }),
      cache: "no-store",
    });
  } catch {
    // best-effort: no bloqueamos la operación del usuario si esto falla
  }
}

// ---------------------------------------------------------------------------
// Sensor readings — account-wide, cursor-based
// ---------------------------------------------------------------------------

export interface SensorReadingsResult {
  readings: CopelandReading[];
  maxGuid: string | null;
  hasMore: boolean;
}

export async function getSensorReadings(
  lastGuid?: string | null
): Promise<SensorReadingsResult> {
  if (process.env.COPELAND_SIMULATE !== "false") {
    return { readings: [], maxGuid: null, hasMore: false };
  }

  const body: Record<string, unknown> = { PageSize: 500 };
  if (lastGuid) body.LastGUID = lastGuid;

  const res = await fetch(`${BASE_URL}/GetSensorReadings`, {
    method: "POST",
    headers: copelandHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GetSensorReadings HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  // Rate limit: no bloqueamos — devolvemos vacío
  if (data.ErrorCode === 601283 || data.ErrorCode === 1011) {
    return { readings: [], maxGuid: lastGuid ?? null, hasMore: false };
  }

  if (data.ErrorCode !== 0 && data.ErrorCode !== null) {
    throw new Error(`GetSensorReadings error ${data.ErrorCode}: ${data.ErrorDescription}`);
  }

  type RawSensor = { SensorId: string; SensorValue: number };
  type RawReading = {
    Guid: string;
    TrackerId: string;
    DateTimeAcquiredUTC: string;
    Latitude: number;
    Longitude: number;
    BatteryPct?: number;
    Sensors?: RawSensor[];
  };

  const readings: CopelandReading[] = (data.SensorReadings ?? []).map((r: RawReading) => ({
    guid: r.Guid,
    device_id: r.TrackerId,
    temperature: r.Sensors?.find((s) => s.SensorId === "G0")?.SensorValue ?? 0,
    latitude: r.Latitude,
    longitude: r.Longitude,
    timestamp: r.DateTimeAcquiredUTC,
    battery: r.BatteryPct ?? 100,
  }));

  return {
    readings,
    maxGuid: data.MaxGUIDReturned ?? null,
    hasMore: data.HasMoreResults === true,
  };
}

// ---------------------------------------------------------------------------
// Simulación por dispositivo (usado cuando COPELAND_SIMULATE=true)
// ---------------------------------------------------------------------------

const ROUTE: Array<{ lat: number; lng: number }> = [
  { lat: 29.0729, lng: -110.9559 }, // Hermosillo
  { lat: 29.3412, lng: -110.9821 },
  { lat: 29.68, lng: -111.02 },
  { lat: 30.05, lng: -110.98 },
  { lat: 30.42, lng: -110.88 },
  { lat: 30.78, lng: -110.75 },
  { lat: 31.12, lng: -110.62 },
  { lat: 31.32, lng: -110.95 }, // Nogales, Sonora
  { lat: 31.35, lng: -110.93 }, // Nogales, AZ
  { lat: 31.55, lng: -110.97 },
  { lat: 31.75, lng: -110.99 },
  { lat: 31.95, lng: -110.98 },
  { lat: 32.22, lng: -110.97 }, // Tucson
];

function interpolate(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  t: number
) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function simulateDeviceReadings(
  deviceId: string,
  opts?: { productTempMin?: number; productTempMax?: number }
): CopelandReading[] {
  const tempMin = opts?.productTempMin ?? 2;
  const tempMax = opts?.productTempMax ?? 8;
  const tempMid = (tempMin + tempMax) / 2;
  const range = tempMax - tempMin;

  const minute = Math.floor(Date.now() / 60_000);
  const seed = hashSeed(deviceId);
  const random = rng(seed + minute);

  const segmentMinutes = 15;
  const totalMinutes = (ROUTE.length - 1) * segmentMinutes;
  const progress = (minute % totalMinutes) / segmentMinutes;
  const segIndex = Math.min(ROUTE.length - 2, Math.floor(progress));
  const segT = progress - segIndex;

  const readings: CopelandReading[] = [];
  for (let i = 9; i >= 0; i--) {
    const drift = (random() - 0.5) * 0.002;
    const t = Math.max(0, Math.min(1, segT - i * 0.02));
    const p = interpolate(ROUTE[segIndex], ROUTE[segIndex + 1], t);
    const spike = random() < 0.1;
    let temp = tempMid + (random() - 0.5) * range * 0.6;
    if (spike) temp = random() < 0.5 ? tempMin - 1 - random() * 2 : tempMax + 1 + random() * 2;

    readings.push({
      device_id: deviceId,
      temperature: Math.round(temp * 10) / 10,
      latitude: Math.round((p.lat + drift) * 1e5) / 1e5,
      longitude: Math.round((p.lng + drift) * 1e5) / 1e5,
      timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      battery: 70 + Math.round(random() * 30),
    });
  }
  return readings;
}

// Alias para compatibilidad con código existente
export async function getDeviceReadings(
  deviceId: string,
  opts?: { productTempMin?: number; productTempMax?: number }
): Promise<CopelandReading[]> {
  return simulateDeviceReadings(deviceId, opts);
}
