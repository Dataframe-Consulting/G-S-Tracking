-- AgroTrack — Migration 002: Catálogos (clientes, lugares_carga, transportistas)
-- Run this in the Supabase SQL editor.

-- ==========================================================================
-- Clientes
-- ==========================================================================
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  created_at timestamptz default now()
);
alter table clientes enable row level security;
drop policy if exists "auth_all" on clientes;
create policy "auth_all" on clientes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ==========================================================================
-- Lugares de carga
-- ==========================================================================
create table if not exists lugares_carga (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz default now()
);
alter table lugares_carga enable row level security;
drop policy if exists "auth_all" on lugares_carga;
create policy "auth_all" on lugares_carga for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed con los valores actuales del enum
insert into lugares_carga (nombre) values ('FRIGO'), ('BODEGA'), ('CAMPO'), ('OTRO')
on conflict do nothing;

-- ==========================================================================
-- Transportistas
-- ==========================================================================
create table if not exists transportistas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  created_at timestamptz default now()
);
alter table transportistas enable row level security;
drop policy if exists "auth_all" on transportistas;
create policy "auth_all" on transportistas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
