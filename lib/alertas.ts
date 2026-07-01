import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppAlert } from "./whatsapp-meta";
import { cToF } from "./temperature";

const COOLDOWN_MINUTES = 30; // minutos de espera entre reenvíos de la misma alerta
const SOSTENIDO_MINUTES = 30; // minutos continuos fuera de rango antes de alertar

export interface CheckAlertaResult {
  viajeId: string;
  fueraRango: boolean;
  alertaEnviada: boolean;
  cooldown: boolean;
  motivo?: "viaje_not_found" | "sin_rango_o_temp" | "sin_lecturas_recientes";
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

  // 1) Lectura más reciente del viaje (sin filtro de tiempo).
  const { data: recientes } = await supabase
    .from("lecturas_temperatura")
    .select("temperatura, fuera_rango, timestamp")
    .eq("viaje_id", viajeId)
    .order("timestamp", { ascending: false })
    .limit(1);

  const lecturaReciente = recientes?.[0] ?? null;

  // Sin ninguna lectura registrada → no se puede evaluar; apagar alerta.
  if (!lecturaReciente) {
    await supabase.from("viajes").update({ alerta_activa: false }).eq("id", viajeId);
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false, motivo: "sin_lecturas_recientes" };
  }

  // 2) La última lectura está dentro de rango → no alertar.
  if (lecturaReciente.fuera_rango !== true) {
    await supabase.from("viajes").update({ alerta_activa: false }).eq("id", viajeId);
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false };
  }

  // 3) Fuera de rango: buscar la última vez que estuvo DENTRO de rango.
  const { data: enRango } = await supabase
    .from("lecturas_temperatura")
    .select("timestamp")
    .eq("viaje_id", viajeId)
    .eq("fuera_rango", false)
    .order("timestamp", { ascending: false })
    .limit(1);

  const ultimaEnRango = enRango?.[0] ?? null;
  const sostenidoAtras = Date.now() - SOSTENIDO_MINUTES * 60_000;

  // Si nunca estuvo dentro de rango, usamos la lectura MÁS ANTIGUA fuera de rango
  // para verificar que la condición lleve 30+ min (evita alertar en la 1ª lectura).
  const { data: primeraFueraRango } = await supabase
    .from("lecturas_temperatura")
    .select("timestamp")
    .eq("viaje_id", viajeId)
    .eq("fuera_rango", true)
    .order("timestamp", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 4) Cumple el mínimo sostenido fuera de rango si la última lectura en rango
  //    (o, si nunca la hubo, la primera fuera de rango) fue hace más de SOSTENIDO_MINUTES.
  const cumpleSostenido = ultimaEnRango
    ? new Date(ultimaEnRango.timestamp).getTime() < sostenidoAtras
    : (!!primeraFueraRango && new Date(primeraFueraRango.timestamp).getTime() < sostenidoAtras);

  // 5) Fuera de rango pero aún no cumple el mínimo continuo → esperar (no alertar).
  if (!cumpleSostenido) {
    return { viajeId, fueraRango: false, alertaEnviada: false, cooldown: false };
  }

  // tipo derivado de la temperatura de la lectura más reciente (no de temp_actual).
  const temp = Number(lecturaReciente.temperatura);
  const tipo: "TEMP_ALTA" | "TEMP_BAJA" = temp > tempMax ? "TEMP_ALTA" : "TEMP_BAJA";

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
    .select("id, ov_ref, cliente")
    .eq("viaje_id", viajeId)
    .limit(1)
    .maybeSingle();

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

  let productoNombre = "—";
  if (primeraOV?.id) {
    const { data: ordenProductos } = await supabase
      .from("orden_productos")
      .select("productos(nombre)")
      .eq("orden_id", primeraOV.id)
      .limit(3);
    productoNombre = ordenProductos && ordenProductos.length > 0
      ? ordenProductos.map((op: any) => (op.productos as any)?.nombre).filter(Boolean).join(", ")
      : "—";
  }

  const sendResults = await sendWhatsAppAlert(
    {
      viajeId,
      cargaRef: primeraOV?.ov_ref ?? viajeId,
      cliente: primeraOV?.cliente ?? "—",
      producto: productoNombre,
      tempActual: temp,
      tempMin,
      tempMax,
      tipo,
      ubicacion,
    },
    destinatarios
  );

  const tempF = (cToF(temp) as number).toFixed(1);
  const tempMaxF = (cToF(tempMax) as number).toFixed(1);
  const tempMinF = (cToF(tempMin) as number).toFixed(1);
  const mensaje =
    tipo === "TEMP_ALTA"
      ? `Temperatura ALTA: ${tempF}°F (máx ${tempMaxF}°F)`
      : `Temperatura BAJA: ${tempF}°F (mín ${tempMinF}°F)`;

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
