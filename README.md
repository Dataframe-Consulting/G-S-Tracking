# AgroTrack

Portal web fullstack de gestión logística para el sector agrónomo. Registra
cargas diarias, asigna termógrafos Copeland, monitorea temperatura y ubicación
en tiempo real, y dispara alertas por WhatsApp (Twilio) cuando la temperatura
sale del rango permitido por producto.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Leaflet** (`react-leaflet`) con tiles de OpenStreetMap
- **Recharts** para gráficas de temperatura
- **Twilio WhatsApp** para alertas
- **Copeland REST API** (modo simulado por defecto, intercambiable en prod)

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar el SQL del schema en Supabase → SQL Editor
# Archivo: db/schema.sql

# 3. Copiar variables de entorno y llenarlas
cp .env.local.example .env.local

# 4. Crear el primer usuario en Supabase Auth
#    (Dashboard → Authentication → Add user)

# 5. Arrancar
npm run dev
```

## Variables de entorno

Ver `.env.local.example`. Mientras no haya credenciales reales de Copeland,
mantén `COPELAND_SIMULATE=true` — el simulador recorre una ruta Hermosillo →
Nogales → Tucson con 1 de cada 10 lecturas fuera de rango para validar
alertas.

## Cron / sincronización automática

- **En producción (Vercel):** `vercel.json` ya define el cron cada 3 minutos
  hacia `/api/copeland/cron`. Vercel envía el header `x-vercel-cron: 1`, que
  el endpoint acepta como autorización. Opcionalmente, configura
  `CRON_SECRET` para invocaciones externas vía `Authorization: Bearer <secret>`.
- **En desarrollo:** el dashboard hace polling cada 3 minutos desde el
  cliente. También puedes forzar una sincronización con el botón
  "Sincronizar ahora" en la vista de detalle de carga.

## Cambiar a la API real de Copeland

1. Define `COPELAND_API_BASE_URL` y `COPELAND_API_KEY`.
2. Pon `COPELAND_SIMULATE=false`.
3. Ajusta el mapping de campos en `lib/copeland.ts` → `fetchRealReadings`
   al formato que devuelva Copeland (el resto del sistema consume el tipo
   normalizado `CopelandReading`).

## Estructura

```
app/
  (app)/                  # Rutas autenticadas (layout con AppShell)
    dashboard/
    cargas/ cargas/[id]/ cargas/nueva/
    termografos/
    alertas/
    configuracion/
  api/
    cargas/ cargas/[id]/
    copeland/sync/ copeland/cron/
    alertas/check/
    config/
  login/
components/
  Cargas/ Dashboard/ Alertas/ Mapa/ Temperatura/ Shell/ brand/
lib/
  supabase.ts copeland.ts twilio.ts alertas.ts sync.ts types.ts
db/
  schema.sql
middleware.ts
```

## Alertas WhatsApp

Los destinatarios se administran desde **Configuración** (`/configuracion`)
y se guardan en `config.whatsapp_destinatarios`. Cada alerta respeta un
cooldown de 30 minutos por carga + tipo para evitar spam.

Si no hay destinatarios configurados se usa el fallback `TWILIO_WHATSAPP_TO`
del entorno (solo para pruebas).
