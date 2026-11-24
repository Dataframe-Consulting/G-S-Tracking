/**
 * Datos de dirección que se mandan a Copeland en cada parada de DefineTrip.
 *
 * Copeland pide `Zip` obligatorio y `State` opcional, y con ellos ubica la
 * parada. Antes se mandaba solo el nombre de la ciudad con Zip "00000". Aquí va
 * el CP central y el estado de las ciudades que usa la operación. Si la ciudad
 * no está en la tabla se manda como antes (Zip "00000", sin estado).
 *
 * `lugar_inicio`/`lugar_fin` son texto libre, así que la búsqueda ignora
 * mayúsculas, acentos y espacios sobrantes ("hermosillo " → Hermosillo).
 */

export interface UbicacionCopeland {
  city: string;
  state: string | null;
  zip: string;
  country: string;
}

type Entrada = { state: string; zip: string; country?: string };

const TABLA: Record<string, Entrada> = {
  "hermosillo": { state: "Sonora", zip: "83000" },
  "caborca": { state: "Sonora", zip: "83600" },
  "ciudad obregon": { state: "Sonora", zip: "85000" },
  "guaymas": { state: "Sonora", zip: "85400" },
  "navojoa": { state: "Sonora", zip: "85800" },
  "nogales": { state: "Sonora", zip: "84000" },
  "ciudad de mexico": { state: "Ciudad de México", zip: "06000" },
  "cd. de mexico": { state: "Ciudad de México", zip: "06000" },
  "cdmx": { state: "Ciudad de México", zip: "06000" },
  "guadalajara": { state: "Jalisco", zip: "44100" },
  "monterrey": { state: "Nuevo León", zip: "64000" },
  "villahermosa": { state: "Tabasco", zip: "86000" },
  "manzanillo": { state: "Colima", zip: "28200" },
  "zacatecas": { state: "Zacatecas", zip: "98000" },
  "culiacan": { state: "Sinaloa", zip: "80000" },
  "los mochis": { state: "Sinaloa", zip: "81200" },
  "mazatlan": { state: "Sinaloa", zip: "82000" },
  "queretaro": { state: "Querétaro", zip: "76000" },
  "chihuahua": { state: "Chihuahua", zip: "31000" },
  "ensenada": { state: "Baja California", zip: "22800" },
  "tijuana": { state: "Baja California", zip: "22000" },
  "mexicali": { state: "Baja California", zip: "21000" },
  "puebla": { state: "Puebla", zip: "72000" },
  "irapuato": { state: "Guanajuato", zip: "36500" },
  "zitacuaro": { state: "Michoacán", zip: "61500" },
  "nogales, us": { state: "AZ", zip: "85621", country: "USA" },
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function ubicacionCopeland(lugar: string): UbicacionCopeland {
  const city = lugar.trim().slice(0, 50);
  const e = TABLA[normalizar(lugar)];
  if (!e) return { city, state: null, zip: "00000", country: "MX" };
  // "Nogales, US" → la ciudad va sin el sufijo de país.
  const cityLimpia = city.replace(/,\s*[A-Z]{2}$/, "");
  return { city: cityLimpia, state: e.state, zip: e.zip, country: e.country ?? "MX" };
}

/**
 * LocationID de una parada. Copeland lo define como "Customer defined unique
 * location ID". Antes se mandaba "ORIG"/"DEST" fijo en todos los viajes, y cada
 * DefineTrip sobrescribía el destino de todos los trips activos: los camiones que
 * estaban en esa ciudad "llegaban", Copeland cerraba su trip (X1D) y el
 * termógrafo dejaba de reportar a medio camino (viaje #0800). Con el número de
 * viaje el ID es único, y todos los termógrafos del mismo viaje comparten la
 * misma parada, que es el mismo lugar.
 */
export function locationIdCopeland(viajeNumero: number | string, tipo: "ORIG" | "DEST"): string {
  return `AT-${viajeNumero}-${tipo}`;
}
