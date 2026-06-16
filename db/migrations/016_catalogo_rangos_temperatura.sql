-- Migration 016: catálogo de rangos de temperatura + productos por rango (Fase 2-3)
--
-- Un rango = (temp_min, temp_max). El "nombre" es el propio rango (ej. "32–44°F").
-- Cada producto pertenece a UN solo rango (productos.rango_id), sin importar la
-- temperatura individual que tenga dada de alta hoy en el catálogo de productos.
-- El viaje puede usar un rango del catálogo (viajes.temp_rango_id); el min/max se
-- copia al viaje y se mantiene "en vivo" propagando los cambios del rango a los
-- viajes que lo usan (lado backend). La lógica de lectura sigue siendo la de
-- Fase 1 (viajes.temp_min/temp_max), retrocompatible.
--
-- Aditivo: columnas nullable + tablas nuevas. No toca temps de producto (eso es
-- una fase futura), no rompe nada existente.

create table if not exists rangos_temperatura (
  id uuid primary key default gen_random_uuid(),
  temp_min numeric(5,2) not null,
  temp_max numeric(5,2) not null,
  created_at timestamptz default now()
);

create unique index if not exists idx_rangos_unico
  on rangos_temperatura (temp_min, temp_max);

alter table productos
  add column if not exists rango_id uuid references rangos_temperatura(id) on delete set null;

alter table viajes
  add column if not exists temp_rango_id uuid references rangos_temperatura(id) on delete set null;

alter table rangos_temperatura enable row level security;
drop policy if exists "auth_all" on rangos_temperatura;
create policy "auth_all" on rangos_temperatura for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
