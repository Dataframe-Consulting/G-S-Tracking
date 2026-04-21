/**
 * Cliente del API de Copeland (termógrafos IoT).
 *
 * MODO REAL: Cuando el cliente entregue credenciales y documentación oficial,
 * reemplazar únicamente `fetchRealReadings` para que apunte al endpoint correcto.
 * El resto del sistema (sync, alertas, UI) no necesita cambios porque todo
 * consume el tipo normalizado `CopelandReading`.
 *
 * MODO SIMULACIÓN: controlado por COPELAND_SIMULATE=true. Genera una ruta
 * continua en territorio mexicano y emite fluctuaciones realistas de
 * temperatura, incluyendo lecturas ocasionalmente fuera de rango para
 * poder probar el pipeline de alertas de WhatsApp.
 */

export interface CopelandReading {
  device_id: string;
  temperature: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  battery: number;
}

export async function getDeviceReadings(
  deviceId: string,
  opts?: { productTempMin?: number; productTempMax?: number }
): Promise<CopelandReading[]> {
  if (process.env.COPELAND_SIMULATE !== "false") {
    return simulateReadings(deviceId, opts);
  }
  return fetchRealReadings(deviceId);
}

// --------------------------------------------------------------------------
// Real API
// --------------------------------------------------------------------------
// TODO: Ajustar mapping de campos a la respuesta real de Copeland. Este
// stub asume un shape razonable; actualizarlo cuando se conozca la doc.
async function fetchRealReadings(deviceId: string): Promise<CopelandReading[]> {
  const base = process.env.COPELAND_API_BASE_URL;
  const key = process.env.COPELAND_API_KEY;
  if (!base || !key) {
    throw new Error("COPELAND_API_BASE_URL / COPELAND_API_KEY not set");
  }
  const res = await fetch(`${base}/devices/${deviceId}/readings?limit=10`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Copeland API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as Array<{
    deviceId?: string;
    device_id?: string;
    temperatureC?: number;
    temperature?: number;
    lat?: number;
    latitude?: number;
    lng?: number;
    longitude?: number;
    battery?: number;
    timestamp?: string;
    recordedAt?: string;
  }>;

  return data.map((d) => ({
    device_id: d.device_id ?? d.deviceId ?? deviceId,
    temperature: d.temperature ?? d.temperatureC ?? 0,
    latitude: d.latitude ?? d.lat ?? 0,
    longitude: d.longitude ?? d.lng ?? 0,
    timestamp: d.timestamp ?? d.recordedAt ?? new Date().toISOString(),
    battery: d.battery ?? 100
  }));
}

// --------------------------------------------------------------------------
// Simulador: ruta Hermosillo → Nogales → Tucson aproximada
// --------------------------------------------------------------------------
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
  { lat: 32.22, lng: -110.97 } // Tucson
];

function interpolate(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number) {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t
  };
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

function simulateReadings(
  deviceId: string,
  opts?: { productTempMin?: number; productTempMax?: number }
): CopelandReading[] {
  const tempMin = opts?.productTempMin ?? 2;
  const tempMax = opts?.productTempMax ?? 8;
  const tempMid = (tempMin + tempMax) / 2;
  const range = tempMax - tempMin;

  // Use wall-clock to advance position deterministically per device
  const minute = Math.floor(Date.now() / 60_000);
  const seed = hashSeed(deviceId);
  const random = rng(seed + minute);

  // Position: travel across segments slowly
  const segmentMinutes = 15;
  const totalMinutes = (ROUTE.length - 1) * segmentMinutes;
  const progress = (minute % totalMinutes) / segmentMinutes;
  const segIndex = Math.min(ROUTE.length - 2, Math.floor(progress));
  const segT = progress - segIndex;
  const pos = interpolate(ROUTE[segIndex], ROUTE[segIndex + 1], segT);

  const readings: CopelandReading[] = [];
  for (let i = 9; i >= 0; i--) {
    // Slight drift on each past reading
    const drift = (random() - 0.5) * 0.002;
    const t = Math.max(0, Math.min(1, segT - i * 0.02));
    const p = interpolate(ROUTE[segIndex], ROUTE[segIndex + 1], t);

    // Temperature fluctuates gently, with ~1 in 10 spikes out of range
    const spike = random() < 0.1;
    let temp = tempMid + (random() - 0.5) * range * 0.6;
    if (spike) {
      temp = random() < 0.5 ? tempMin - 1 - random() * 2 : tempMax + 1 + random() * 2;
    }

    readings.push({
      device_id: deviceId,
      temperature: Math.round(temp * 10) / 10,
      latitude: Math.round((p.lat + drift) * 1e5) / 1e5,
      longitude: Math.round((p.lng + drift) * 1e5) / 1e5,
      timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      battery: 70 + Math.round(random() * 30)
    });
  }
  return readings;
}
