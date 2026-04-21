import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppAlert } from "./twilio";

const COOLDOWN_MINUTES = 30;

export interface CheckAlertaResult {
  cargaId: string;
  fueraRango: boolean;
  alertaEnviada: boolean;
  cooldown: boolean;
  motivo?: string;
}

export async function checkAlertas(
  supabase: SupabaseClient,
  cargaId: string
): Promise<CheckAlertaResult> {
  const { data: carga, error } = await supabase
    .from("cargas")
    .select(
      `id, ov_ref, cliente, producto_descripcion, temp_actual, lat, lng,
       producto:productos ( nombre, temp_min, temp_max )`
    )
    .eq("id", cargaId)
    .single();

  if (error || !carga) {
    return { cargaId, fueraRango: false, alertaEnviada: false, cooldown: false, motivo: "carga_not_found" };
  }

  const producto = Array.isArray(carga.producto) ? carga.producto[0] : carga.producto;
  if (!producto || carga.temp_actual == null) {
    return { cargaId, fueraRango: false, alertaEnviada: false, cooldown: false, motivo: "sin_producto_o_temp" };
  }

  const temp = Number(carga.temp_actual);
  const tempMin = Number(producto.temp_min);
  const tempMax = Number(producto.temp_max);

  const fueraRango = temp < tempMin || temp > tempMax;
  const tipo: "TEMP_ALTA" | "TEMP_BAJA" = temp > tempMax ? "TEMP_ALTA" : "TEMP_BAJA";

  if (!fueraRango) {
    await supabase.from("cargas").update({ alerta_activa: false }).eq("id", cargaId);
    return { cargaId, fueraRango: false, alertaEnviada: false, cooldown: false };
  }

  // Flag active alert
  await supabase.from("cargas").update({ alerta_activa: true }).eq("id", cargaId);

  // Check cooldown: avoid spamming if an alert of same type was sent recently
  const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("alertas_log")
    .select("id")
    .eq("carga_id", cargaId)
    .eq("tipo", tipo)
    .gte("created_at", since)
    .limit(1);

  if (recent && recent.length > 0) {
    return { cargaId, fueraRango: true, alertaEnviada: false, cooldown: true };
  }

  // Destinatarios from config
  const { data: cfg } = await supabase
    .from("config")
    .select("value")
    .eq("key", "whatsapp_destinatarios")
    .single();

  const destinatarios = Array.isArray(cfg?.value) ? (cfg!.value as string[]) : [];

  const ubicacion =
    carga.lat != null && carga.lng != null
      ? `https://maps.google.com/?q=${carga.lat},${carga.lng}`
      : undefined;

  const sendResults = await sendWhatsAppAlert(
    {
      cargaRef: carga.ov_ref,
      cliente: carga.cliente,
      producto: producto.nombre,
      tempActual: temp,
      tempMin,
      tempMax,
      tipo,
      ubicacion
    },
    destinatarios
  );

  const mensaje =
    tipo === "TEMP_ALTA"
      ? `Temperatura ALTA: ${temp}°C (máx ${tempMax}°C)`
      : `Temperatura BAJA: ${temp}°C (mín ${tempMin}°C)`;

  const rows = sendResults.map((r) => ({
    carga_id: cargaId,
    tipo,
    temperatura: temp,
    mensaje: r.error ? `${mensaje} — ERROR: ${r.error}` : mensaje,
    whatsapp_sid: r.sid ?? null,
    enviado_a: r.to
  }));

  if (rows.length > 0) {
    await supabase.from("alertas_log").insert(rows);
  }

  const anySent = sendResults.some((r) => r.sid);
  return { cargaId, fueraRango: true, alertaEnviada: anySent, cooldown: false };
}
