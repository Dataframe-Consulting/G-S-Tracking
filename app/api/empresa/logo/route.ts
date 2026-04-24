import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const BUCKET = "empresa";

export async function GET() {
  const service = createServiceSupabase();
  const { data } = await service
    .from("empresa_config")
    .select("logo_url")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json({ logo_url: data?.logo_url ?? null });
}

export async function POST(req: Request) {
  // Verify the requesting user is master
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = createServiceSupabase();
  const { data: profile } = await service
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "master") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;
  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Formato no soportado. Usa PNG, JPG, WEBP o SVG." }, { status: 400 });
  }

  // Ensure bucket exists (no-op if already created)
  await service.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() ?? "png";
  const path = `logo.${ext}`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = service.storage.from(BUCKET).getPublicUrl(path);
  // Append timestamp to bust CDN cache on re-upload
  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await service
    .from("empresa_config")
    .upsert({ id: 1, logo_url: logoUrl, updated_at: new Date().toISOString() });

  return NextResponse.json({ logo_url: logoUrl });
}
