-- Migration 024: RPC para la última lectura de cada termógrafo asignado.
--
-- El export de viajes (app/api/viajes/reporte/route.ts) calculaba la columna "Temp"
-- haciendo una query por termógrafo asignado (N+1): con ~98 termógrafos eran ~98
-- round-trips HTTP. Cada una corre en ~0.2 ms usando idx_lecturas_viaje_timestamp,
-- así que el costo real era la red, no la BD.
--
-- Esta función hace esos mismos index scans del lado del servidor con un
-- cross join lateral, devolviendo todo en un solo round-trip (~20 ms) y sin
-- degradarse conforme crece lecturas_temperatura.
--
-- Semántica idéntica a la del código que reemplaza:
--   * solo termógrafos asignados y NO deshabilitados
--   * la lectura más reciente de cada par (viaje, termógrafo)
--   * los termógrafos sin lecturas no aparecen (el lateral los descarta), igual que
--     antes se descartaban por temperatura null al promediar
--
-- Es `stable` y NO `security definer`: corre con los permisos de quien llama, así que
-- el RLS de termografos/lecturas_temperatura aplica igual que en las queries directas.

create or replace function ultima_lectura_por_termografo(p_viaje_ids uuid[])
returns table (viaje_id uuid, termografo_id text, temperatura numeric)
language sql
stable
as $$
  select t.viaje_id, t.id, l.temperatura
  from termografos t
  cross join lateral (
    select l2.temperatura
    from lecturas_temperatura l2
    where l2.viaje_id = t.viaje_id
      and l2.termografo_id = t.id
    order by l2."timestamp" desc
    limit 1
  ) l
  where t.asignado
    and not t.deshabilitado
    and t.viaje_id = any(p_viaje_ids);
$$;

comment on function ultima_lectura_por_termografo(uuid[]) is
  'Última lectura de temperatura de cada termógrafo asignado y no deshabilitado de los viajes dados. Evita el N+1 del export de viajes.';
