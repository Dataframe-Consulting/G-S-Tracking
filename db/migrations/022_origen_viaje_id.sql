-- AgroTrack — Migration 022: viajes.origen_viaje_id
-- Cambio 2: cuando se rechaza una o varias cargas y se crea un viaje NUEVO para
-- re-rutearlas, este campo guarda la relación histórica "este viaje nació del
-- rechazo del viaje origen". Nullable: los viajes normales quedan en null.
-- ON DELETE SET NULL para no romper si algún día se borra el viaje origen.
--
-- Aditiva y no destructiva: los viajes existentes quedan con null, sin impacto.
-- Corrida en producción vía Supabase MCP el 2026-07-20.

alter table viajes add column origen_viaje_id uuid references viajes(id) on delete set null;
