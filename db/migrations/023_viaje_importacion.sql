-- AgroTrack — Migration 023: importación por viaje
-- Marca un viaje como de importación y su etapa actual del proceso (una a la vez).
-- Los códigos se guardan en BD; las etiquetas viven en el código (lib/types.ts):
--   INSPECCION_CALIDAD → "En inspección de Calidad"
--   EN_CRUCE           → "En cruce"
--   INTACTICS          → "En InTactics (Almacenado)"
--   INSPECCION_SADER   → "En inspección SADER"
--   CERTIFICADO        → "Certificado"
--
-- Aditiva y no destructiva: es_importacion NOT NULL default false; importacion_estado
-- nullable con CHECK. Los viajes existentes quedan en false / null.
-- Corrida en producción vía Supabase MCP el 2026-07-31.

alter table viajes add column es_importacion boolean not null default false;
alter table viajes add column importacion_estado text
  check (importacion_estado is null or importacion_estado in
    ('INSPECCION_CALIDAD','EN_CRUCE','INTACTICS','INSPECCION_SADER','CERTIFICADO'));
