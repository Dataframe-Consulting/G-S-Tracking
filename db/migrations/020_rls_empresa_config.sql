-- AgroTrack — Migration 020: habilitar RLS en empresa_config
-- La tabla estaba expuesta a la anon key (RLS deshabilitado).
-- La app solo accede vía service role (createServiceSupabase), que ignora RLS,
-- por lo que activar RLS sin políticas cierra el acceso anon sin romper la app.
-- Corrida en producción vía Supabase MCP el 2026-07-20.

alter table empresa_config enable row level security;
