-- AgroTrack — Migration 021: termografos.deshabilitado
-- Cambio 1: al completar una carga en un viaje con 2+ termógrafos, el usuario
-- puede deshabilitar uno o varios. "Deshabilitado" = AgroTrack deja de usar sus
-- lecturas para promedio/alertas y no pide nuevas, PERO conserva el vínculo
-- histórico con el viaje (asignado + viaje_id intactos) y NO cierra el trip en
-- Copeland. Se muestra en el detalle con estado "Deshabilitado".
--
-- Aditiva y no destructiva: NOT NULL con default false → los termógrafos
-- existentes quedan en false, sin afectar viajes activos ni el sync.
-- Corrida en producción vía Supabase MCP el 2026-07-20.

alter table termografos add column deshabilitado boolean not null default false;
