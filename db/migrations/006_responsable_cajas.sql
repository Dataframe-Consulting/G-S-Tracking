-- Migration 006: responsable en viajes, cajas en ordenes_venta

alter table viajes
  add column if not exists responsable_id uuid references user_profiles(user_id) on delete set null;

alter table ordenes_venta
  add column if not exists cajas integer,
  add column if not exists cajas_b integer;
