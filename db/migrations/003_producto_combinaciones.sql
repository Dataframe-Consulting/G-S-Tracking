-- AgroTrack — Migration 003: Combinaciones de productos
-- Run this in the Supabase SQL editor.

create table if not exists producto_combinaciones (
  id          uuid primary key default gen_random_uuid(),
  producto_a_id uuid not null references productos(id) on delete cascade,
  producto_b_id uuid not null references productos(id) on delete cascade,
  temp_min    numeric(5,1) not null,
  temp_max    numeric(5,1) not null,
  created_at  timestamptz default now(),
  constraint temp_range_check check (temp_min < temp_max),
  constraint no_self_combo    check (producto_a_id <> producto_b_id)
);

alter table producto_combinaciones enable row level security;
drop policy if exists "auth_all" on producto_combinaciones;
create policy "auth_all" on producto_combinaciones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
