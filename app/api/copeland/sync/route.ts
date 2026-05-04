import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const viajeId = searchParams.get("viajeId");
  const supabase = createServerSupabase();
  const result = await runSync(supabase, viajeId);
  return NextResponse.json(result);
}
