-- Migration 025: el rango del viaje se deriva de sus cargas
--
-- fecha_inicio = MIN(fecha_carga)   de todas las OVs del viaje
-- fecha_fin    = MAX(fecha_entrega) de todas las OVs del viaje
--
-- El viaje se crea antes de tener cargas, así que su rango tiene que poder no
-- existir todavía. Sin dato se guarda NULL: nunca una fecha inventada ni "hoy".

alter table viajes
  alter column fecha_inicio drop not null,
  alter column fecha_fin    drop not null;

-- Marca de qué viajes viven bajo la lógica nueva. El `default false` congela de
-- un golpe a los 294 viajes existentes: el helper de recálculo corta antes de
-- leer nada cuando la bandera está en false, así que un viaje histórico no
-- cambia de fechas ni siquiera si alguien edita una de sus cargas.
--
-- No hay UPDATE ni backfill a propósito: recalcular el histórico completo haría
-- que 152 viajes PERDIERAN su fecha_fin (ninguna de sus OVs tiene fecha_entrega,
-- por el bug del toggle que arregló la fase 1) y reescribiría 28 trips en
-- Copeland sin razón. Si más adelante se decide corregir el histórico, basta
-- poner en true los viajes que se quieran recalcular.
alter table viajes
  add column if not exists fechas_automaticas boolean not null default false;

comment on column viajes.fechas_automaticas is
  'true = fecha_inicio/fecha_fin se derivan de las OVs (MIN fecha_carga / MAX fecha_entrega). false = capturadas a mano, congeladas.';
