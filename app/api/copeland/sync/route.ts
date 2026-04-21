import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const cargaId = searchParams.get("cargaId");
  const supabase = createServerSupabase();
  const result = await runSync(supabase, cargaId);
  return NextResponse.json(result);
}
