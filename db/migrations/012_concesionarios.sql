-- Migration 012: Concesionarios y sus líneas de transportista (catálogo de 2 niveles)
-- Reemplaza el catálogo plano de transportistas. Sin campo contacto en ningún nivel:
-- el contacto vive en los "Datos del viaje" (ver migración posterior).

create table if not exists concesionarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz default now()
);
alter table concesionarios enable row level security;
drop policy if exists "auth_all" on concesionarios;
create policy "auth_all" on concesionarios for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists lineas_transportista (
  id uuid primary key default gen_random_uuid(),
  concesionario_id uuid not null references concesionarios(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now()
);
create index if not exists idx_lineas_concesionario
  on lineas_transportista (concesionario_id);
alter table lineas_transportista enable row level security;
drop policy if exists "auth_all" on lineas_transportista;
create policy "auth_all" on lineas_transportista for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed: los transportistas actuales se convierten en concesionarios (sin líneas).
-- Idempotente: no duplica si ya existe un concesionario con ese nombre.
insert into concesionarios (nombre)
  select t.nombre from transportistas t
  where not exists (
    select 1 from concesionarios c where c.nombre = t.nombre
  );
