-- Migration 014: ubicación geocodificada del viaje + caché de geocoding
--
-- Guarda la última ubicación resuelta (ciudad/estado/país) directamente en el
-- viaje, para que la tabla la muestre sin geocodificar en cada render.
-- `ubicacion_geo_key` es la coordenada redondeada que se resolvió por última vez:
-- si no cambia entre syncs, no se vuelve a geocodificar (el camión sigue en la
-- misma zona).
--
-- `geocode_cache` es un caché COMPARTIDO entre todos los viajes: coordenada
-- redondeada -> ubicación. Evita re-llamar al proveedor por una misma zona.
-- Crece acotado por geografía (no por tráfico), filas mínimas.

alter table viajes
  add column if not exists ubicacion_ciudad text,
  add column if not exists ubicacion_estado text,
  add column if not exists ubicacion_pais text,
  add column if not exists ubicacion_geo_key text;

create table if not exists geocode_cache (
  geo_key text primary key,
  ciudad text,
  estado text,
  pais text,
  created_at timestamptz default now()
);

alter table geocode_cache enable row level security;

drop policy if exists "auth_all" on geocode_cache;
create policy "auth_all" on geocode_cache for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
