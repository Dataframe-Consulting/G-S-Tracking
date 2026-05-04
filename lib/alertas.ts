import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppAlert } from "./twilio";

const COOLDOWN_MINUTES = 30;

export interface CheckAlertaResult {
  viajeId: string;
  fueraRango: boolean;
  alertaEnviada: boolean;
  cooldown: boolean;
  motivo?: string;
}

export async function checkAlertas(
  supabase: SupabaseClient,
  viajeId: string,
  tempMin?: number,
  tempMax?: number
): Promise<CheckAlertaResult> {
  const { data: viaje, error } = await supabase
    .from("viajes")
    .select(`id, temp_actual, lat, lng`)
    .eq("id", viajeId)
    .single();

  if (error || !viaje) {
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false, motivo: "viaje_not_found" };
  }

  if (tempMin == null || tempMax == null || viaje.temp_actual == null) {
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false, motivo: "sin_rango_o_temp" };
  }

  const temp = Number(viaje.temp_actual);
  const fueraRango = temp < tempMin || temp > tempMax;
  const tipo: "TEMP_ALTA" | "TEMP_BAJA" = temp > tempMax ? "TEMP_ALTA" : "TEMP_BAJA";

  if (!fueraRango) {
    await supabase.from("viajes").update({ alerta_activa: false }).eq("id", viajeId);
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false };
  }

  await supabase.from("viajes").update({ alerta_activa: true }).eq("id", viajeId);

  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("alertas_log")
    .select("id")
    .eq("viaje_id", viajeId)
    .eq("tipo", tipo)
    .gte("created_at", since)
    .limit(1);

  if (recent && recent.length > 0) {
    return { viajeId, fueraRango: true, alertaEnviada: false, cooldown: true };
  }

  // Get OV info for the alert message (first OV with a client)
  const { data: primeraOV } = await supabase
    .from("ordenes_venta")
    .select("ov_ref, cliente, producto:productos(nombre)")
    .eq("viaje_id", viajeId)
    .limit(1)
    .single();

  const { data: cfg } = await supabase
    .from("config")
    .select("value")
    .eq("key", "whatsapp_destinatarios")
    .single();

  const destinatarios = Array.isArray(cfg?.value) ? (cfg!.value as string[]) : [];

  const ubicacion =
    viaje.lat != null && viaje.lng != null
      ? `https://maps.google.com/?q=${viaje.lat},${viaje.lng}`
      : undefined;

  const productoObj = primeraOV
    ? (Array.isArray(primeraOV.producto) ? primeraOV.producto[0] : primeraOV.producto)
    : null;

  const sendResults = await sendWhatsAppAlert(
    {
      cargaRef: primeraOV?.ov_ref ?? viajeId,
      cliente: primeraOV?.cliente ?? "—",
      producto: productoObj?.nombre ?? "—",
      tempActual: temp,
      tempMin,
      tempMax,
      tipo,
      ubicacion,
    },
    destinatarios
  );

  const mensaje =
    tipo === "TEMP_ALTA"
      ? `Temperatura ALTA: ${temp}°C (máx ${tempMax}°C)`
      : `Temperatura BAJA: ${temp}°C (mín ${tempMin}°C)`;

  const rows = sendResults.map((r) => ({
    viaje_id: viajeId,
    tipo,
    temperatura: temp,
    mensaje: r.error ? `${mensaje} — ERROR: ${r.error}` : mensaje,
    whatsapp_sid: r.sid ?? null,
    enviado_a: r.to,
  }));

  if (rows.length > 0) {
    await supabase.from("alertas_log").insert(rows);
  }

  const anySent = sendResults.some((r) => r.sid);
  return { viajeId, fueraRango: true, alertaEnviada: anySent, cooldown: false };
}
