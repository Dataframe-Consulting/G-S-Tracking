import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("producto_combinaciones").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
