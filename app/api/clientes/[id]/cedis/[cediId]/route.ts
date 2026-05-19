import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; cediId: string } }
) {
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("cedis")
    .delete()
    .eq("id", params.cediId)
    .eq("cliente_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
