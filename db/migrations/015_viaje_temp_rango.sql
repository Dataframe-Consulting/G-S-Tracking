-- Migration 015: rango de temperatura propio del viaje (Fase 1)
--
-- El viaje puede tener su PROPIO rango de temperatura, independiente de los
-- productos de sus OVs. Cuando está definido, es la fuente de verdad para
-- alertas/monitoreo/display. Cuando es null, el sistema cae al cálculo viejo
-- (intersección de los rangos de los productos de las OVs) — retrocompatible.
--
-- Aditivo y nullable: no toca datos existentes, los viajes actuales siguen
-- funcionando con el fallback hasta que se les defina un rango manual.

alter table viajes
  add column if not exists temp_min numeric(5,2),
  add column if not exists temp_max numeric(5,2);
