import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = ["master", "operador", "visor"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const service = createServiceSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await service
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const requesterRole: Role = profile?.role ?? "master";

  if (requesterRole !== "master") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (params.id === user.id) {
    // Bloqueo de auto-cambio: evita que el master se degrade y pierda acceso
    // (y garantiza que siempre quede al menos un master).
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const role = (body as { role?: string }).role;
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Upsert por si el usuario no tuviera fila de perfil (default era visor).
  const { error } = await service
    .from("user_profiles")
    .upsert({ user_id: params.id, role }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const service = createServiceSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await service
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const requesterRole: Role = profile?.role ?? "master";

  if (requesterRole !== "master") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (params.id === user.id) return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });

  await service.from("user_profiles").delete().eq("user_id", params.id);
  const { error } = await service.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
