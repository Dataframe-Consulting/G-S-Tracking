import { NextResponse } from "next/server";
import https from "node:https";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.oversight.copeland.com/edi";

function postViaHttps(
  endpoint: string,
  payload: string,
  apiKey: string,
  subKey: string
): Promise<{ status: number; body: string }> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LT-ApiKey": apiKey,
          "Ocp-Apim-Subscription-Key": subKey,
          "Content-Length": String(Buffer.byteLength(payload)),
          "Accept": "*/*",
          "User-Agent": "agrotrack/1.0",
        },
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (chunks += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: chunks }));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function tryRequest(endpoint: string, body: Record<string, unknown>) {
  const apiKey = process.env.COPELAND_API_KEY!;
  const subKey = process.env.COPELAND_SUBSCRIPTION_KEY!;

  try {
    const res = await postViaHttps(endpoint, JSON.stringify(body), apiKey, subKey);
    let json: unknown = null;
    try { json = JSON.parse(res.body); } catch { json = res.body; }
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
    const res = await postViaHttps(endpoint, JSON.stringify(body), apiKey, subKey);
    let json: unknown = null;
    try { json = JSON.parse(res.body); } catch { json = res.body; }
    return { status: res.status, body: json };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

export async function GET() {
  const [test1, test2, test3] = await Promise.all([
    tryRequest("GetSensorReadings", {}),
    tryRequest("GetSensorReadings", { PageSize: 2 }),
    tryRequestSwapped("GetSensorReadings", { PageSize: 2 }),
  ]);

  return NextResponse.json({
    keys_usadas: {
      X_LT_ApiKey: process.env.COPELAND_API_KEY?.slice(0, 8) + "...",
      Ocp_Apim: process.env.COPELAND_SUBSCRIPTION_KEY?.slice(0, 8) + "...",
    },
    "test1_POST_body_vacio": test1,
    "test2_POST_pagesize_2": test2,
    "test3_POST_keys_intercambiadas": test3,
  });
}
