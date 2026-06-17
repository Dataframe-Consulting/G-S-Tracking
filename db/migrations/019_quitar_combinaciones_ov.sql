-- Migration 019: limpieza del modelo viejo de OV (Fase 5) — DESTRUCTIVA
--
-- Tras pasar a orden_productos (migración 018) y desplegar el código que ya no
-- usa las columnas/combos viejos, se eliminan:
--   · ordenes_venta.producto_id, producto_combinacion_id, cajas, cajas_b
--   · tabla producto_combinaciones (ya no se usan las combinaciones)
--
-- ⚠️ DESTRUCTIVA: borra columnas/tabla y sus datos. Correr SOLO después de que el
-- código nuevo esté desplegado en main/prod (de lo contrario, el código viejo que
-- aún lea esas columnas truena). Como dev y prod comparten BD, pega al instante.
--
-- El backfill de la 018 ya copió todo a orden_productos (combos → 2 productos),
-- así que aquí no se pierde info de productos/cajas.

alter table ordenes_venta
  drop column if exists producto_id,
  drop column if exists producto_combinacion_id,
  drop column if exists cajas,
  drop column if exists cajas_b;

drop table if exists producto_combinaciones;
