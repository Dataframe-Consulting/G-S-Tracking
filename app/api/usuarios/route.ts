import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = ["master", "operador", "visor"];

async function getRequesterRole(supabase: ReturnType<typeof createServerSupabase>, service: ReturnType<typeof createServiceSupabase>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await service
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  // No profile = dev fallback (treated as master)
  return { userId: user.id, role: (profile?.role ?? "master") as Role };
}

export async function GET() {
  const service = createServiceSupabase();
  const result = await service.auth.admin.listUsers();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  const { data: profiles } = await service.from("user_profiles").select("*");
  const profileMap = new Map((profiles ?? []).map((p: { user_id: string; role: string; nombre: string | null }) => [p.user_id, p]));

  const users = (result.data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    role: (profileMap.get(u.id) as { role: Role } | undefined)?.role ?? "master",
    nombre: (profileMap.get(u.id) as { nombre: string | null } | undefined)?.nombre ?? null,
    created_at: u.created_at
  }));

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const service = createServiceSupabase();

  const requester = await getRequesterRole(supabase, service);
  if (!requester) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (requester.role !== "master") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const { email, password, role, nombre } = body as {
    email?: string;
    password?: string;
    role?: string;
    nombre?: string;
  };

  if (!email || !password || !role) {
    return NextResponse.json({ error: "Email, contraseña y rol son requeridos" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const createResult = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createResult.error) return NextResponse.json({ error: createResult.error.message }, { status: 400 });

  const newUser = createResult.data.user;
  const { error: profileError } = await service.from("user_profiles").insert({
    user_id: newUser.id,
    role,
    nombre: nombre || null,
    email
  });

  if (profileError) {
    await service.auth.admin.deleteUser(newUser.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    user: { id: newUser.id, email, role, nombre: nombre || null, created_at: newUser.created_at }
  });
}
