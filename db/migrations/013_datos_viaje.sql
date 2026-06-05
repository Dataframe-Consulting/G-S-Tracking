-- Migration 013: Datos del viaje (unidad) en la tabla viajes
-- Liga el viaje a una línea transportista (cuyo concesionario se muestra como "Flete")
-- y agrega los datos manuales de la unidad. El flete_cargo (texto) se conserva legacy.

alter table viajes
  add column if not exists linea_transportista_id uuid references lineas_transportista(id) on delete set null,
  add column if not exists operador text,
  add column if not exists modelo text,
  add column if not exists anio text,
  add column if not exists placas_tracto text,
  add column if not exists placas_caja text,
  add column if not exists contacto_unidad text;
