-- Migration 010: hacer ov_ref opcional en ordenes_venta
-- El constraint UNIQUE se mantiene; Postgres permite múltiples NULL,
-- así que varias OVs sin referencia conviven sin chocar.

alter table ordenes_venta
  alter column ov_ref drop not null;
