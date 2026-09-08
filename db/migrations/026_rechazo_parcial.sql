-- Migration 026: rechazo parcial de una carga
--
-- Hasta ahora un rechazo era siempre de la carga completa: la OV pasaba a
-- RECHAZO_CALIDAD y su copia en el viaje nuevo llevaba las mismas cajas. No
-- habia forma de decir "de las 420 cajas de uva, 150 salieron mal".

-- Cajas rechazadas de esta linea de producto. NULL o 0 = ninguna.
-- Se registra APARTE de `cajas` en vez de descontarlas: asi no se pierde cuanto
-- se cargo originalmente, y el rechazo queda escrito aunque no se cree viaje
-- nuevo (un rechazo de calidad muchas veces es merma, no se re-rutea).
-- Aceptadas = cajas - coalesce(cajas_rechazadas, 0).
alter table orden_productos
  add column if not exists cajas_rechazadas integer;

alter table orden_productos
  add constraint orden_productos_cajas_rechazadas_valido
  check (
    cajas_rechazadas is null
    or (cajas_rechazadas >= 0 and (cajas is null or cajas_rechazadas <= cajas))
  );

-- De que carga salio esta copia. Permite mostrar "150 cj rechazadas -> viaje
-- #327" en la carga origen y encontrar el re-ruteo sin leer la auditoria.
-- El vinculo viaje->viaje ya existia (viajes.origen_viaje_id); faltaba el de
-- carga->carga, que el endpoint de rechazo ya usaba pero no persistia.
alter table ordenes_venta
  add column if not exists origen_ov_id uuid references ordenes_venta(id) on delete set null;

create index if not exists idx_ordenes_venta_origen_ov on ordenes_venta (origen_ov_id);

comment on column orden_productos.cajas_rechazadas is
  'Cajas rechazadas de esta linea. Las aceptadas son cajas - coalesce(cajas_rechazadas,0).';
comment on column ordenes_venta.origen_ov_id is
  'Carga de la que salio esta copia al re-rutear un rechazo.';
