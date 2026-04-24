-- AgroTrack — Migration 004: producto_combinacion_id en cargas
-- Run this in the Supabase SQL editor.

alter table cargas
  add column if not exists producto_combinacion_id uuid
  references producto_combinaciones(id) on delete set null;
