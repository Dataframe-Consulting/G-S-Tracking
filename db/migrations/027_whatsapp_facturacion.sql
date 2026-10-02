-- Migration 027: control mensual de costos de WhatsApp (Meta Cloud API)
--
-- Meta cobra POR MENSAJE ENTREGADO, no por mensaje enviado. En septiembre 2026
-- se enviaron 7,498 y Meta solo entregó 5,255 (bloqueo por adeudo): contar
-- nuestros registros habría facturado $1,173 cuando el cobro real fue $822.
-- Por eso `mensajes` y `costo_mxn` vienen de la API de Meta (pricing_analytics),
-- no de alertas_log. `enviados` guarda nuestro conteo solo para comparar: una
-- brecha grande entre ambos es la señal temprana de un problema con la cuenta.
--
-- Meta corta los meses en la zona horaria de la cuenta (America/Phoenix, UTC-7),
-- no en UTC. Con ese corte agosto cuadró exacto contra la API (6,290 = 6,290).
--
-- Meta NO expone por API si una factura está pagada (se probaron invoices,
-- billing, transactions y funding source: ninguno existe o da permiso). El
-- estado de pago es por fuerza manual, y solo master puede marcarlo.

create table if not exists whatsapp_facturacion (
  periodo         text primary key,                -- 'AAAA-MM', ej. '2026-09'
  mensajes        integer not null default 0,      -- entregados y cobrables, según Meta
  costo_mxn       numeric(10,2) not null default 0,-- costo real que reporta Meta
  enviados        integer,                         -- nuestro conteo (alertas_log)
  estado          text not null default 'PENDIENTE'
                  check (estado in ('PENDIENTE', 'PAGADO')),
  pagado_at       timestamptz,
  pagado_por      uuid,                            -- user_profiles.user_id de quien marcó
  nota            text,
  sincronizado_at timestamptz,                     -- última lectura desde Meta
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_whatsapp_facturacion_estado
  on whatsapp_facturacion (estado, periodo desc);

alter table whatsapp_facturacion enable row level security;
drop policy if exists "auth_all" on whatsapp_facturacion;
create policy "auth_all" on whatsapp_facturacion for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

comment on table whatsapp_facturacion is
  'Costo mensual de los mensajes de WhatsApp. mensajes/costo_mxn los reporta Meta; el estado de pago es manual porque Meta no lo expone por API.';
comment on column whatsapp_facturacion.mensajes is
  'Mensajes ENTREGADOS según Meta. Es lo que cobra: los aceptados pero no entregados no se facturan.';
comment on column whatsapp_facturacion.enviados is
  'Mensajes que AgroTrack envió (alertas_log). Si es mucho mayor que `mensajes`, Meta no está entregando.';
