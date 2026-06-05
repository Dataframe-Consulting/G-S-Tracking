-- Migration 011: datos de cita opcionales en ordenes_venta
-- La cita de entrega se agenda tiempo después de crear la carga, así que
-- fecha_entrega se vuelve opcional y se agregan los campos de cita bajo un toggle.

alter table ordenes_venta
  alter column fecha_entrega drop not null;

alter table ordenes_venta
  add column if not exists tiene_cita boolean not null default false,
  add column if not exists po text,
  add column if not exists folio_cita text,
  add column if not exists factura_gys text;

-- Cargas existentes: conservan visible su info de entrega/cita.
update ordenes_venta set tiene_cita = true
  where fecha_entrega is not null or cita is not null;
