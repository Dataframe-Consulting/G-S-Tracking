import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Lee .env (CRLF-safe)
const env = {};
fs.readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i > 0 && !l.trim().startsWith("#")) {
      env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  });

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const geoKey = (lat, lng) => `${Number(lat).toFixed(1)},${Number(lng).toFixed(1)}`;

async function geocode(lat, lng) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=10&lat=${lat}&lon=${lng}`,
    { headers: { "Accept-Language": "es-MX,es", "User-Agent": "AgroTrack-GS-Tracking/1.0 (logistica)" } }
  );
  if (!r.ok) return null;
  const a = (await r.json())?.address ?? {};
  const ciudad =
    a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb ?? a.county ?? a.state_district ?? null;
  const estado = a.state ?? null;
  const pais = a.country ?? null;
  if (!ciudad && !estado && !pais) return null;
  return { ciudad, estado, pais };
}

const { data: viajes } = await sb
  .from("viajes")
  .select("id, numero, lat, lng")
  .not("lat", "is", null)
  .not("lng", "is", null);

console.log(`Viajes con coordenadas: ${viajes.length}`);

// Resolver por geo_key único (caché en memoria + tabla)
const resolved = new Map();
for (const v of viajes) {
  const key = geoKey(v.lat, v.lng);
  if (resolved.has(key)) continue;
  const { data: cached } = await sb.from("geocode_cache").select("ciudad, estado, pais").eq("geo_key", key).maybeSingle();
  if (cached) {
    resolved.set(key, cached);
    continue;
  }
  const loc = await geocode(v.lat, v.lng);
  await sleep(1100); // respetar rate limit Nominatim
  if (loc) {
    await sb.from("geocode_cache").upsert({ geo_key: key, ...loc }, { onConflict: "geo_key" });
    resolved.set(key, loc);
    console.log(`  ${key} -> ${loc.estado ?? loc.ciudad}`);
  } else {
    resolved.set(key, null);
    console.log(`  ${key} -> (sin datos)`);
  }
}

// Escribir en cada viaje
let escritos = 0;
for (const v of viajes) {
  const loc = resolved.get(geoKey(v.lat, v.lng));
  if (!loc) continue;
  await sb
    .from("viajes")
    .update({
      ubicacion_ciudad: loc.ciudad,
      ubicacion_estado: loc.estado,
      ubicacion_pais: loc.pais,
      ubicacion_geo_key: geoKey(v.lat, v.lng),
    })
    .eq("id", v.id);
  escritos++;
}

console.log(`Listo: ${escritos} viajes actualizados con ubicación.`);
