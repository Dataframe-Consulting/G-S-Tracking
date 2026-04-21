import Twilio from "twilio";

export interface WhatsAppAlertPayload {
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
  sid?: string;
  error?: string;
}

function buildMessage(p: WhatsAppAlertPayload): string {
  const header =
    p.tipo === "TEMP_ALTA" ? "🔴 Temperatura ALTA" : "🔵 Temperatura BAJA";
  const lines = [
    "⚠️ *ALERTA TEMPERATURA*",
    "",
    `*Carga:* ${p.cargaRef}`,
    `*Cliente:* ${p.cliente}`,
    `*Producto:* ${p.producto}`,
    `*Temperatura actual:* ${p.tempActual}°C`,
    `*Rango permitido:* ${p.tempMin}°C – ${p.tempMax}°C`,
    `*Tipo:* ${header}`
  ];
  if (p.ubicacion) lines.push(`*Ubicación:* ${p.ubicacion}`);
  return lines.join("\n");
}

export async function sendWhatsAppAlert(
  payload: WhatsAppAlertPayload,
  destinatarios: string[]
): Promise<WhatsAppSendResult[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  const fallback = process.env.TWILIO_WHATSAPP_TO;
  const targets = destinatarios.length > 0
    ? destinatarios
    : fallback
      ? [fallback]
      : [];

  if (targets.length === 0) {
    return [{ to: "", error: "No destinatarios configurados" }];
  }

  if (!sid || !token || !from) {
    return targets.map((to) => ({
      to,
      error: "Twilio no configurado (falta SID/TOKEN/FROM)"
    }));
  }

  const client = Twilio(sid, token);
  const body = buildMessage(payload);

  const results: WhatsAppSendResult[] = [];
  for (const raw of targets) {
    const to = raw.startsWith("whatsapp:") ? raw : `whatsapp:${raw}`;
    try {
      const msg = await client.messages.create({ from, to, body });
      results.push({ to, sid: msg.sid });
    } catch (err) {
      results.push({
        to,
        error: err instanceof Error ? err.message : "Error enviando WhatsApp"
      });
    }
  }
  return results;
}
