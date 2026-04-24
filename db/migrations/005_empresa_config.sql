-- AgroTrack — Migration 005: empresa_config
-- Stores global company settings (logo URL, etc.)
-- Run this in the Supabase SQL editor.

create table if not exists empresa_config (
  id int primary key default 1,
  logo_url text,
  updated_at timestamptz default now()
);

-- Single-row table; seed it so upsert always works.
insert into empresa_config (id) values (1) on conflict do nothing;
