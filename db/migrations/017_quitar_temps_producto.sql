-- Migration 017: quitar temperaturas del catálogo de productos (Fase 4) — DESTRUCTIVA
--
-- Los productos y las combinaciones ya NO tienen temperatura propia. El rango de
-- temperatura lo define el viaje (manual o desde el catálogo de Temperaturas).
--
-- ⚠️ DESTRUCTIVA: borra columnas y sus datos. Correr SOLO después de desplegar el
-- código que ya no usa estas columnas (de lo contrario, prod truena). Como dev y
-- prod comparten BD, esto afecta producción al instante.
--
-- Antes de correr: asegúrate de haber capturado las temps que necesites en el
-- catálogo de Temperaturas (rangos_temperatura), porque aquí se pierden.

alter table productos
  drop column if exists temp_min,
  drop column if exists temp_max;

alter table producto_combinaciones
  drop column if exists temp_min,
  drop column if exists temp_max;
