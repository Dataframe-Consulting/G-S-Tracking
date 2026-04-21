import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAlertas } from "@/lib/alertas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const cargaId = searchParams.get("cargaId");
  if (!cargaId) return NextResponse.json({ error: "cargaId required" }, { status: 400 });

  const supabase = createServerSupabase();
  const result = await checkAlertas(supabase, cargaId);
  return NextResponse.json(result);
}
