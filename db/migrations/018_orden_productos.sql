-- Migration 018: productos múltiples por OV (Fase 5) — ADITIVA + backfill
--
-- Una OV pasa de "1 producto o 1 combinación" a "N productos, cada uno con sus
-- cajas". Tabla puente orden_productos. Se permiten productos repetidos en una
-- misma OV (sin restricción de unicidad). cajas es opcional.
--
-- Backfill (sin perder historial):
--   · OV simple (producto_id)         → 1 fila (producto_id, cajas)
--   · OV combo (producto_combinacion) → 2 filas (producto_a con cajas, producto_b con cajas_b)
--
-- Aditiva: no toca columnas existentes. Las columnas viejas (producto_id,
-- producto_combinacion_id, cajas, cajas_b) y la tabla producto_combinaciones se
-- eliminan en la migración 019 (destructiva), DESPUÉS de desplegar el código nuevo.

create table if not exists orden_productos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_venta(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  cajas integer,
  created_at timestamptz default now()
);

create index if not exists idx_orden_productos_orden on orden_productos (orden_id);

-- Backfill OVs simples
insert into orden_productos (orden_id, producto_id, cajas)
select id, producto_id, cajas
from ordenes_venta
where producto_id is not null;

-- Backfill combos → producto A (cajas)
insert into orden_productos (orden_id, producto_id, cajas)
select ov.id, pc.producto_a_id, ov.cajas
from ordenes_venta ov
join producto_combinaciones pc on pc.id = ov.producto_combinacion_id
where ov.producto_combinacion_id is not null;

-- Backfill combos → producto B (cajas_b)
insert into orden_productos (orden_id, producto_id, cajas)
select ov.id, pc.producto_b_id, ov.cajas_b
from ordenes_venta ov
join producto_combinaciones pc on pc.id = ov.producto_combinacion_id
where ov.producto_combinacion_id is not null;

alter table orden_productos enable row level security;
drop policy if exists "auth_all" on orden_productos;
create policy "auth_all" on orden_productos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
