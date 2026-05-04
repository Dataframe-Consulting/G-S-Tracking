import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("producto_combinaciones")
    .select(`*, producto_a:productos!producto_a_id(id, nombre), producto_b:productos!producto_b_id(id, nombre)`)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
