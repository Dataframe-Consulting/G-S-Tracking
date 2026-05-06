import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.oversight.copeland.com/edi";

async function tryRequest(endpoint: string, body: Record<string, unknown>, method = "POST") {
  const apiKey = process.env.COPELAND_API_KEY!;
  const subKey = process.env.COPELAND_SUBSCRIPTION_KEY!;

  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-LT-ApiKey": apiKey,
        "Ocp-Apim-Subscription-Key": subKey,
      },
      body: method === "GET" ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

async function tryRequestSwapped(endpoint: string, body: Record<string, unknown>) {
  // Prueba con las keys intercambiadas por si están al revés
  const apiKey = process.env.COPELAND_SUBSCRIPTION_KEY!;
  const subKey = process.env.COPELAND_API_KEY!;

  try {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LT-ApiKey": apiKey,
        "Ocp-Apim-Subscription-Key": subKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

export async function GET() {
  const [
    test1,  // POST body vacío
    test2,  // POST PageSize: 2 (igual al ejemplo del doc)
    test3,  // GET sin body
    test4,  // Keys intercambiadas
  ] = await Promise.all([
    tryRequest("GetSensorReadings", {}),
    tryRequest("GetSensorReadings", { PageSize: 2 }),
    tryRequest("GetSensorReadings", {}, "GET"),
    tryRequestSwapped("GetSensorReadings", { PageSize: 2 }),
  ]);

  return NextResponse.json({
    keys_usadas: {
      X_LT_ApiKey: process.env.COPELAND_API_KEY?.slice(0, 8) + "...",
      Ocp_Apim: process.env.COPELAND_SUBSCRIPTION_KEY?.slice(0, 8) + "...",
    },
    "test1_POST_body_vacio": test1,
    "test2_POST_pagesize_2": test2,
    "test3_GET_sin_body": test3,
    "test4_POST_keys_intercambiadas": test4,
  });
}
