// Envío de alertas de WhatsApp vía Meta Cloud API (WhatsApp Business API).
// Reemplaza a lib/twilio.ts manteniendo la MISMA interfaz pública
// (WhatsAppAlertPayload, WhatsAppSendResult, sendWhatsAppAlert) para que
// lib/alertas.ts solo tenga que cambiar el import.
//
// Env vars necesarias:
//   WHATSAPP_TOKEN            — token de acceso de Meta (System User Token)
//   WHATSAPP_PHONE_NUMBER_ID  — ID del número emisor (ej. 116481645O053471)
//   WHATSAPP_TO               — número fallback si `destinatarios` está vacío
//
// La BD/API trabajan en °C; los mensajes se muestran en °F (cToF).

import { cToF } from "./temperature";

const GRAPH_VERSION = "v20.0";

export interface WhatsAppAlertPayload {
  viajeId: string;
  cargaRef: string;
  cliente: string;
  producto: string;
  tempActual: number;
  tempMin: number;
  tempMax: number;
  tipo: "TEMP_ALTA" | "TEMP_BAJA";
  ubicacion?: string;
}

export interface WhatsAppSendResult {
  to: string;
  sid?: string; // messages[0].id de Meta (equivalente al SID de Twilio)
  error?: string;
}

// Respuesta de Meta Cloud API en envío exitoso.
interface MetaSendResponse {
  messages?: Array<{ id: string }>;
}

// Respuesta de error de Meta Cloud API.
interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string };
}

// Meta espera el número en formato 521XXXXXXXXXX (solo dígitos, sin "+" ni
// prefijo "whatsapp:"). Normalizamos por si la config trae formato de Twilio.
function normalizeNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

export async function sendWhatsAppAlert(
  payload: WhatsAppAlertPayload,
  destinatarios: string[]
): Promise<WhatsAppSendResult[]> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const fallback = process.env.WHATSAPP_TO;
  const targets = destinatarios.length > 0
    ? destinatarios
    : fallback
      ? [fallback]
      : [];

  if (targets.length === 0) {
    return [{ to: "", error: "No destinatarios configurados" }];
  }

  if (!token || !phoneNumberId) {
    return targets.map((to) => ({
      to,
      error: "Meta WhatsApp no configurado (falta WHATSAPP_TOKEN/PHONE_NUMBER_ID)"
    }));
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

  // Variables de la plantilla aprobada "alerta_temperatura" (idioma es_MX).
  const tempActualF = (cToF(payload.tempActual) as number).toFixed(1);
  const tempMinF = (cToF(payload.tempMin) as number).toFixed(1);
  const tempMaxF = (cToF(payload.tempMax) as number).toFixed(1);
  const tipoTexto =
    payload.tipo === "TEMP_ALTA" ? "🔴 Temperatura ALTA" : "🔵 Temperatura BAJA";
  const viajeId = payload.viajeId;

  const results: WhatsAppSendResult[] = [];
  for (const raw of targets) {
    const to = normalizeNumber(raw);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: "alerta_temperatura",
            language: { code: "es_MX" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: payload.cargaRef },  // {{1}}
                  { type: "text", text: payload.cliente },   // {{2}}
                  { type: "text", text: payload.producto },  // {{3}}
                  { type: "text", text: tempActualF },       // {{4}}
                  { type: "text", text: tempMinF },          // {{5}}
                  { type: "text", text: tempMaxF },          // {{6}}
                  { type: "text", text: tipoTexto },         // {{7}}
                  { type: "text", text: payload.ubicacion ?? "No disponible" }, // {{8}}
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: viajeId },           // {{1}} del botón URL dinámico
                ],
              },
            ],
          },
        }),
        signal: controller.signal,
      });

      const responseText = await res.text();

      let json: (MetaSendResponse & MetaErrorResponse) | null = null;
      try {
        json = JSON.parse(responseText) as MetaSendResponse & MetaErrorResponse;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          json?.error?.message ?? `Meta API respondió ${res.status}`;
        results.push({ to, error: msg });
        continue;
      }

      const id = json?.messages?.[0]?.id;
      if (!id) {
        results.push({ to, error: "Meta API no devolvió messages[0].id" });
        continue;
      }
      results.push({ to, sid: id });
    } catch (err) {
      const errName =
        typeof err === "object" && err !== null
          ? (err as { name?: string }).name
          : undefined;
      results.push({
        to,
        error:
          errName === "AbortError"
            ? "Meta API timeout"
            : err instanceof Error
              ? err.message
              : "Error enviando WhatsApp",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return results;
}
