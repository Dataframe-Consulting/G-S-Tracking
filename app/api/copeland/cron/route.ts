import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const authorized = isVercelCron || (secret && auth === `Bearer ${secret}`);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const result = await runSync(supabase, null);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
