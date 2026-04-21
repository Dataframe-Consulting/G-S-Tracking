-- AgroTrack database schema
-- Run this in the Supabase SQL editor (all at once).

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
-- Cargas
-- ==========================================================================
create table if not exists cargas (
  id uuid primary key default gen_random_uuid(),
  fecha_carga date not null,
  fecha_entrega date not null,
  cita text,
  cliente text not null,
  ov_ref text not null unique,
  lugar_carga text not null,
  producto_descripcion text not null,
  producto_id uuid references productos(id),
  status text not null default 'PENDIENTE'
    check (status in ('PENDIENTE','EN_PREPARACION','TRANSITO','ENTREGADO','RECIBIDO','RECHAZO_CALIDAD')),
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
-- Historial de lecturas de temperatura
-- ==========================================================================
create table if not exists lecturas_temperatura (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid references cargas(id) on delete cascade,
  termografo_id text not null,
  temperatura numeric(5,2) not null,
  lat numeric(10,7),
  lng numeric(10,7),
  timestamp timestamptz default now(),
  fuera_rango boolean default false
);
create index if not exists idx_lecturas_carga_timestamp
  on lecturas_temperatura (carga_id, timestamp desc);

-- ==========================================================================
-- Log de alertas
-- ==========================================================================
create table if not exists alertas_log (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid references cargas(id) on delete cascade,
  tipo text not null,
  temperatura numeric(5,2),
  mensaje text,
  whatsapp_sid text,
  enviado_a text,
  created_at timestamptz default now()
);
create index if not exists idx_alertas_carga
  on alertas_log (carga_id, created_at desc);

-- ==========================================================================
-- Termógrafos disponibles
-- ==========================================================================
create table if not exists termografos (
  id text primary key,
  nombre text,
  asignado boolean default false,
  carga_id uuid references cargas(id),
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
-- Configuración (números de WhatsApp para alertas, settings globales)
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
alter table cargas enable row level security;
alter table lecturas_temperatura enable row level security;
alter table alertas_log enable row level security;
alter table termografos enable row level security;
alter table productos enable row level security;
alter table config enable row level security;

drop policy if exists "auth_all" on cargas;
drop policy if exists "auth_all" on lecturas_temperatura;
drop policy if exists "auth_all" on alertas_log;
drop policy if exists "auth_all" on termografos;
drop policy if exists "auth_all" on productos;
drop policy if exists "auth_all" on config;

create policy "auth_all" on cargas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on lecturas_temperatura for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on alertas_log for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on termografos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on productos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on config for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ==========================================================================
-- Realtime
-- ==========================================================================
do $$
begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cargas';
  if not found then
    alter publication supabase_realtime add table cargas;
  end if;
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lecturas_temperatura';
  if not found then
    alter publication supabase_realtime add table lecturas_temperatura;
  end if;
end $$;
