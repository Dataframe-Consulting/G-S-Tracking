import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const KEY = "whatsapp_destinatarios";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("config")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const value = Array.isArray(data?.value) ? (data!.value as string[]) : [];
  return NextResponse.json({ destinatarios: value });
}

export async function PUT(req: Request) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const list: string[] = Array.isArray(body.destinatarios) ? body.destinatarios : [];

  const cleaned = list
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .map((s) => (s.startsWith("whatsapp:") ? s : `whatsapp:${s}`));

  const { error } = await supabase
    .from("config")
    .upsert(
      { key: KEY, value: cleaned, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ destinatarios: cleaned });
}
