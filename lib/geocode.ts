import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Ubicacion = {
  geo_key: string;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
};

// Redondeo de la coordenada para agrupar zonas y cachear: 1 decimal ≈ 11 km.
// Grueso a propósito → muchísimas lecturas comparten una sola entrada de caché,
// minimizando llamadas al proveedor de geocoding (la mostramos a nivel ciudad/estado).
function geoKey(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

// Resuelve lat/lng a Ciudad/Estado/País. Estrategia:
//   1. Caché compartido en BD (geocode_cache) por coordenada redondeada → sin llamada.
//   2. Miss → una sola llamada a Nominatim (campos estructurados), se cachea.
// Nunca lanza: si falla o no hay datos, devuelve nulls SIN cachear (se reintenta luego).
export async function resolveUbicacion(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<Ubicacion> {
  const key = geoKey(lat, lng);
  try {
    const { data: cached } = await supabase
      .from("geocode_cache")
      .select("ciudad, estado, pais")
      .eq("geo_key", key)
      .maybeSingle();
    if (cached) {
      return { geo_key: key, ciudad: cached.ciudad, estado: cached.estado, pais: cached.pais };
    }

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=10&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "Accept-Language": "es-MX,es",
          // Nominatim exige un User-Agent identificable; sin él puede bloquear.
          "User-Agent": "AgroTrack-GS-Tracking/1.0 (logistica)",
        },
      }
    );
    if (!res.ok) return { geo_key: key, ciudad: null, estado: null, pais: null };
    const data = await res.json();
    const a = data?.address ?? {};

    // Fallback rural: del nivel más fino al más amplio, lo "más cerca" disponible.
    const ciudad =
      a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb ??
      a.county ?? a.state_district ?? null;
    const estado = a.state ?? null;
    const pais = a.country ?? null;

    // Sin nada útil → no cacheamos (para reintentar en el próximo sync).
    if (!ciudad && !estado && !pais) {
      return { geo_key: key, ciudad: null, estado: null, pais: null };
    }

    await supabase
      .from("geocode_cache")
      .upsert({ geo_key: key, ciudad, estado, pais }, { onConflict: "geo_key" });

    return { geo_key: key, ciudad, estado, pais };
  } catch {
    return { geo_key: key, ciudad: null, estado: null, pais: null };
  }
}
