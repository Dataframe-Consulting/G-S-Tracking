-- AgroTrack database schema v2
-- Run this in the Supabase SQL editor (all at once).
-- Drops old tables and recreates with new structure.

-- ==========================================================================
-- Drop old tables (in dependency order)
-- ==========================================================================
drop table if exists alertas_log cascade;
drop table if exists lecturas_temperatura cascade;
drop table if exists ordenes_venta cascade;
drop table if exists termografos cascade;
drop table if exists viajes cascade;
drop table if exists cargas cascade;

-- ==========================================================================
-- Productos con rangos de temperatura
-- ==========================================================================
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  temp_min numeric(5,2) not null,
  temp_max numeric(5,2) not null,
  created_at timestamptz default now()
);

insert into productos (nombre, temp_min, temp_max) values
  ('Uva Verde Clam', 0, 4),
  ('Aguacate Convencional', 5, 13),
  ('Aguacate Orgánico', 5, 13),
  ('Tomate', 10, 15),
  ('Fresa', 0, 4),
  ('Mango', 13, 18)
on conflict do nothing;

-- ==========================================================================
-- Combinaciones de productos
-- ==========================================================================
create table if not exists producto_combinaciones (
  id uuid primary key default gen_random_uuid(),
  producto_a_id uuid not null references productos(id),
  producto_b_id uuid not null references productos(id),
  temp_min numeric(5,2) not null,
  temp_max numeric(5,2) not null,
  created_at timestamptz default now()
);

-- ==========================================================================
-- Viajes
-- ==========================================================================
create table viajes (
  id uuid primary key default gen_random_uuid(),
  numero serial not null,
  lugar_inicio text not null,
  lugar_fin text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  flete_cargo text,
  termografo_id text,
  temp_actual numeric(5,2),
  lat numeric(10,7),
  lng numeric(10,7),
  ultima_lectura timestamptz,
  alerta_activa boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==========================================================================
-- Órdenes de Venta (dentro de cada viaje)
-- ==========================================================================
create table ordenes_venta (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references viajes(id) on delete cascade,
  ov_ref text not null unique,
  cliente text not null,
  fecha_carga date not null,
  lugar_carga text not null,
  fecha_entrega date not null,
  lugar_entrega text not null,
  cita text,
  status text not null default 'PENDIENTE'
    check (status in ('PENDIENTE','EN_PREPARACION','TRANSITO','ENTREGADO','RECIBIDO','RECHAZO_CALIDAD')),
  instrucciones text not null,
  producto_id uuid references productos(id),
  producto_combinacion_id uuid references producto_combinaciones(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_ordenes_viaje on ordenes_venta (viaje_id);

-- ==========================================================================
-- Historial de lecturas de temperatura
-- ==========================================================================
create table lecturas_temperatura (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid references viajes(id) on delete cascade,
  termografo_id text not null,
  temperatura numeric(5,2) not null,
  lat numeric(10,7),
  lng numeric(10,7),
  timestamp timestamptz default now(),
  fuera_rango boolean default false
);

create index idx_lecturas_viaje_timestamp
  on lecturas_temperatura (viaje_id, timestamp desc);

-- ==========================================================================
-- Log de alertas
-- ==========================================================================
create table alertas_log (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid references viajes(id) on delete cascade,
  tipo text not null,
  temperatura numeric(5,2),
  mensaje text,
  whatsapp_sid text,
  enviado_a text,
  created_at timestamptz default now()
);

create index idx_alertas_viaje on alertas_log (viaje_id, created_at desc);

-- ==========================================================================
-- Termógrafos disponibles
-- ==========================================================================
create table termografos (
  id text primary key,
  nombre text,
  asignado boolean default false,
  viaje_id uuid references viajes(id),
  ultima_actividad timestamptz
);

insert into termografos (id, nombre) values
  ('CPL-001', 'Copeland 001'),
  ('CPL-002', 'Copeland 002'),
  ('CPL-003', 'Copeland 003'),
  ('CPL-004', 'Copeland 004'),
  ('CPL-005', 'Copeland 005')
on conflict do nothing;

-- ==========================================================================
-- Perfiles de usuario y roles
-- ==========================================================================
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null default 'visor'
    check (role in ('master', 'operador', 'visor')),
  nombre text,
  email text,
  created_at timestamptz default now()
);

-- ==========================================================================
-- Configuración global
-- ==========================================================================
create table if not exists config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into config (key, value) values
  ('whatsapp_destinatarios', '[]'::jsonb)
on conflict do nothing;

-- ==========================================================================
-- Row level security
-- ==========================================================================
alter table viajes enable row level security;
alter table ordenes_venta enable row level security;
alter table lecturas_temperatura enable row level security;
alter table alertas_log enable row level security;
alter table termografos enable row level security;
alter table productos enable row level security;
alter table producto_combinaciones enable row level security;
alter table config enable row level security;
alter table user_profiles enable row level security;

drop policy if exists "auth_all" on viajes;
drop policy if exists "auth_all" on ordenes_venta;
drop policy if exists "auth_all" on lecturas_temperatura;
drop policy if exists "auth_all" on alertas_log;
drop policy if exists "auth_all" on termografos;
drop policy if exists "auth_all" on productos;
drop policy if exists "auth_all" on producto_combinaciones;
drop policy if exists "auth_all" on config;
drop policy if exists "auth_all" on user_profiles;

create policy "auth_all" on viajes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on ordenes_venta for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on lecturas_temperatura for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on alertas_log for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on termografos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on productos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on producto_combinaciones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on config for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on user_profiles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ==========================================================================
-- Realtime
-- ==========================================================================
do $$
begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'viajes';
  if not found then
    alter publication supabase_realtime add table viajes;
  end if;
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lecturas_temperatura';
  if not found then
    alter publication supabase_realtime add table lecturas_temperatura;
  end if;
end $$;
