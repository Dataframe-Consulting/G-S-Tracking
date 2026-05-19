-- Migration 008: cedis por cliente + campo cedi en ordenes_venta

create table if not exists cedis (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now()
);

alter table cedis enable row level security;
drop policy if exists "auth_all" on cedis;
create policy "auth_all" on cedis for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table ordenes_venta
  add column if not exists cedi text;
