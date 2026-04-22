import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { nombre } = await req.json();
  const service = createServiceSupabase();

  // Try update first (row should already exist from user creation)
  const { data: existing } = await service
    .from("user_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await service
      .from("user_profiles")
      .update({ nombre: nombre?.trim() || null, email: user.email })
      .eq("user_id", user.id));
  } else {
    ({ error } = await service
      .from("user_profiles")
      .insert({ user_id: user.id, nombre: nombre?.trim() || null, email: user.email, role: "master" }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
