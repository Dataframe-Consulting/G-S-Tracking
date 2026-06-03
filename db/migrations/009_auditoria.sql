-- Migration 009: auditoría de cambios en viajes y OVs

create table if not exists auditoria (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid references viajes(id) on delete cascade,
  ov_id uuid references ordenes_venta(id) on delete set null,
  user_id uuid,
  user_nombre text,
  tipo text not null check (tipo in ('CREACION', 'MODIFICACION')),
  descripcion text not null,
  created_at timestamptz default now()
);

create index if not exists idx_auditoria_viaje
  on auditoria (viaje_id, created_at desc);

alter table auditoria enable row level security;

drop policy if exists "auth_all" on auditoria;
create policy "auth_all" on auditoria for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
