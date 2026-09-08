import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { STATUS_LABELS, type Status } from "@/lib/types";
import { logAuditMany, STATUS_CHANGE_AUDIT_PREFIX } from "@/lib/audit";
import { ponerOVsEnTransitoAlAsignar } from "@/lib/termografo";
import { sincronizarRangoViaje } from "@/lib/rangoViaje";

// Cambio 2 — Rechazo de cargas + (opcional) creación de un viaje nuevo para
// re-rutearlas. Todo en un solo endpoint, diseñado para ser IDEMPOTENTE:
//   - El id del viaje nuevo lo genera el cliente (nuevo_viaje_id, UUID). Si la
//     petición se repite (doble-submit / retry), el viaje ya existe y NO se
//     recrea; las demás operaciones también son idempotentes.
//   - Transferir termógrafo = solo reasignar viaje_id (mantiene asignado=true,
//     NO cierra el trip en Copeland, NO hace backfill). Las lecturas NUEVAS rutan
//     solas al viaje nuevo por el trackerMap del sync; las viejas quedan en el
//     viaje origen. El viaje nuevo arranca su historial desde cero.
//   - Las lecturas/alertas históricas del origen NO se mueven ni se duplican.
// Solo master/operador.

const REJECTABLE: Status[] = ["PENDIENTE", "EN_PREPARACION", "TRANSITO"];

// Detalle de un rechazo parcial (migración 026): cuántas cajas de cada línea de
// producto salieron mal. Si no viene, el rechazo es de la carga completa.
//   parciales: { [ov_id]: { [orden_producto_id]: cajas_rechazadas } }
type ParcialPorOV = Record<string, Record<string, number>>;

type ProductoInput = { producto_id?: string; cajas?: number | null };
type OvNueva = {
  origen_ov_id: string;
  ov_ref?: string | null;
  cliente?: string;
  cedi?: string | null;
  fecha_carga?: string;
  lugar_carga?: string;
  fecha_entrega?: string | null;
  lugar_entrega?: string;
  cita?: string | null;
  tiene_cita?: boolean;
  po?: string | null;
  folio_cita?: string | null;
  factura_gys?: string | null;
  instrucciones?: string;
  productos?: ProductoInput[];
};

// Carga nueva (creada desde cero) para el viaje nuevo. No proviene de un rechazo.
type OvExtra = {
  ov_ref?: string | null;
  cliente?: string;
  cedi?: string | null;
  fecha_carga?: string;
  lugar_carga?: string;
  fecha_entrega?: string | null;
  cita?: string | null;
  tiene_cita?: boolean;
  po?: string | null;
  folio_cita?: string | null;
  factura_gys?: string | null;
  status?: Status;
  instrucciones?: string;
  productos?: ProductoInput[];
};

async function requireOperador(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = profile?.role ?? "master";
  if (role !== "master" && role !== "operador") {
    return { error: "Sin permiso para rechazar cargas", status: 403 as const };
  }
  return { error: null as null };
}

function statusLabel(v: unknown): string {
  return STATUS_LABELS[v as Status] ?? String(v ?? "(vacío)");
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const auth = await requireOperador(supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const ovIds: string[] = Array.isArray(body.ov_ids) ? body.ov_ids.filter(Boolean) : [];
  if (ovIds.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos una carga" }, { status: 400 });
  }
  const crearViaje = !!body.crear_viaje;

  // Rechazos parciales: la carga NO pasa a RECHAZO_CALIDAD, se le anota cuántas
  // cajas se rechazaron por línea. Las que no aparecen aquí son rechazo total.
  const parciales: ParcialPorOV =
    body.parciales && typeof body.parciales === "object" ? body.parciales : {};

  // Viaje origen (para numero en auditoría) + cargas a rechazar. Solo se rechazan
  // las que pertenecen a ESTE viaje y están en un estado rechazable.
  const { data: viajeOrigen } = await supabase
    .from("viajes")
    .select("numero")
    .eq("id", params.id)
    .maybeSingle();
  if (!viajeOrigen) {
    return NextResponse.json({ error: "Viaje no encontrado" }, { status: 404 });
  }

  const { data: origenOVs } = await supabase
    .from("ordenes_venta")
    .select("id, ov_ref, status")
    .eq("viaje_id", params.id)
    .in("id", ovIds);

  const rechazables = (origenOVs ?? []).filter((o) =>
    REJECTABLE.includes(o.status as Status)
  );
  if (rechazables.length === 0) {
    return NextResponse.json(
      { error: "Ninguna de las cargas seleccionadas se puede rechazar" },
      { status: 400 }
    );
  }
  const rechazablesIds = rechazables.map((o) => o.id as string);

  let nuevoViaje: { id: string; numero: number } | null = null;
  let transferidos: string[] = [];

  if (crearViaje) {
    const nuevoViajeId: string | undefined = body.nuevo_viaje_id;
    if (!nuevoViajeId) {
      return NextResponse.json({ error: "Falta nuevo_viaje_id" }, { status: 400 });
    }
    const v = body.viaje ?? {};
    // Las fechas ya no se piden: el rango del viaje nuevo se deriva de sus cargas.
    for (const k of ["lugar_inicio", "lugar_fin"]) {
      if (!v[k]) return NextResponse.json({ error: `Falta viaje.${k}` }, { status: 400 });
    }

    const ovsNuevas: OvNueva[] = Array.isArray(body.ovs) ? body.ovs : [];
    const ovsExtra: OvExtra[] = Array.isArray(body.ovs_extra) ? body.ovs_extra : [];

    // Validar cargas nuevas (creadas desde cero): requieren cliente, fecha y lugar
    // de carga, y al menos un producto (igual que crear una OV normal).
    for (const n of ovsExtra) {
      if (!n.cliente || !n.fecha_carga || !n.lugar_carga) {
        return NextResponse.json(
          { error: "Cada carga nueva necesita cliente, fecha y lugar de carga" },
          { status: 400 }
        );
      }
      if (!(n.productos ?? []).some((p) => p?.producto_id)) {
        return NextResponse.json(
          { error: "Cada carga nueva necesita al menos un producto" },
          { status: 400 }
        );
      }
    }

    // Validar que las OV/REF capturadas (copias + nuevas) no choquen con otras
    // existentes (ov_ref es UNIQUE). Se excluyen las del propio viaje nuevo para no
    // romper la idempotencia en un retry (donde las OVs ya existen con esas refs).
    const refsCapturadas = [
      ...new Set(
        [...ovsNuevas, ...ovsExtra]
          .map((o) => (o.ov_ref ?? "").trim())
          .filter((r) => r.length > 0)
      ),
    ];
    if (refsCapturadas.length > 0) {
      const { data: dupes } = await supabase
        .from("ordenes_venta")
        .select("ov_ref")
        .in("ov_ref", refsCapturadas)
        .neq("viaje_id", nuevoViajeId);
      if (dupes && dupes.length > 0) {
        return NextResponse.json(
          { error: `La OV/REF "${dupes[0].ov_ref}" ya existe. Usa una diferente.` },
          { status: 409 }
        );
      }
    }

    // Idempotencia: si el viaje nuevo ya existe (retry/doble-submit) no lo recreamos.
    const { data: existente } = await supabase
      .from("viajes")
      .select("id, numero, origen_viaje_id")
      .eq("id", nuevoViajeId)
      .maybeSingle();

    if (existente) {
      if (existente.origen_viaje_id !== params.id) {
        return NextResponse.json({ error: "nuevo_viaje_id inválido" }, { status: 409 });
      }
      nuevoViaje = { id: existente.id as string, numero: existente.numero as number };
    } else {
      const { data: creado, error: errViaje } = await supabase
        .from("viajes")
        .insert({
          id: nuevoViajeId,
          origen_viaje_id: params.id,
          lugar_inicio: v.lugar_inicio,
          lugar_fin: v.lugar_fin,
          // El rango NO se hereda del viaje origen: se deriva de las cargas que
          // se le copien, más abajo. Heredarlo traía las fechas de un viaje que
          // ya no corresponde a esta carga.
          fecha_inicio: null,
          fecha_fin: null,
          fechas_automaticas: true,
          flete_cargo: v.flete_cargo ?? null,
          responsable_id: v.responsable_id ?? null,
          linea_transportista_id: v.linea_transportista_id ?? null,
          temp_min: v.temp_min ?? null,
          temp_max: v.temp_max ?? null,
          temp_rango_id: v.temp_rango_id ?? null,
        })
        .select("id, numero")
        .single();
      if (errViaje || !creado) {
        return NextResponse.json(
          { error: errViaje?.message ?? "Error al crear el viaje nuevo" },
          { status: 400 }
        );
      }
      nuevoViaje = { id: creado.id as string, numero: creado.numero as number };
    }

    // Copiar las cargas al viaje nuevo (status PENDIENTE). Idempotente: si el viaje
    // nuevo ya tiene OVs, asumimos que la copia ya ocurrió (retry) y no duplicamos.
    const { data: yaCopiadas } = await supabase
      .from("ordenes_venta")
      .select("id")
      .eq("viaje_id", nuevoViaje.id)
      .limit(1);

    if (!yaCopiadas || yaCopiadas.length === 0) {
      for (const rid of rechazablesIds) {
        const override = ovsNuevas.find((o) => o.origen_ov_id === rid);
        // Leer la original completa para heredar lo que el usuario no editó.
        const { data: orig } = await supabase
          .from("ordenes_venta")
          .select("*")
          .eq("id", rid)
          .single();
        if (!orig) continue;

        const payload = {
          viaje_id: nuevoViaje.id,
          // ov_ref es UNIQUE: la original la conserva en Rechazados, así que la
          // copia arranca sin ref (null) salvo que el usuario capture una nueva.
          ov_ref: (override?.ov_ref ?? "").trim() || null,
          cliente: override?.cliente ?? orig.cliente,
          cedi: override?.cedi ?? orig.cedi ?? null,
          fecha_carga: override?.fecha_carga ?? orig.fecha_carga,
          lugar_carga: override?.lugar_carga ?? orig.lugar_carga,
          fecha_entrega: override?.fecha_entrega ?? null,
          lugar_entrega: override?.lugar_entrega ?? orig.lugar_entrega ?? "",
          cita: override?.cita ?? null,
          tiene_cita: override?.tiene_cita ?? false,
          po: override?.po ?? null,
          folio_cita: override?.folio_cita ?? null,
          factura_gys: override?.factura_gys ?? null,
          status: "PENDIENTE" as Status,
          instrucciones: override?.instrucciones ?? orig.instrucciones ?? "",
          // Vínculo carga→carga: permite mostrar "150 cj rechazadas → viaje #327"
          // en la carga origen sin tener que leer la auditoría.
          origen_ov_id: rid,
        };
        const { data: nuevaOV, error: errOV } = await supabase
          .from("ordenes_venta")
          .insert(payload)
          .select("id")
          .single();
        if (errOV || !nuevaOV) continue;

        // Productos de la copia:
        //   - rechazo parcial → solo las cajas rechazadas de cada línea
        //   - rechazo total   → override si viene, si no las de la original
        const parcialDeEsta = parciales[rid];
        let productos: ProductoInput[] = [];
        if (parcialDeEsta) {
          const { data: op } = await supabase
            .from("orden_productos")
            .select("id, producto_id, cajas")
            .eq("orden_id", rid);
          productos = (op ?? [])
            .map((l) => ({
              producto_id: l.producto_id as string,
              cajas: parcialDeEsta[l.id as string] ?? 0,
            }))
            .filter((l) => (l.cajas ?? 0) > 0);
        } else {
          productos =
            override?.productos && override.productos.length > 0 ? override.productos : [];
          if (productos.length === 0) {
            const { data: op } = await supabase
              .from("orden_productos")
              .select("producto_id, cajas")
              .eq("orden_id", rid);
            productos = (op ?? []) as ProductoInput[];
          }
        }
        const rows = productos
          .filter((p) => p && p.producto_id)
          .map((p) => ({
            orden_id: nuevaOV.id,
            producto_id: p.producto_id as string,
            cajas: p.cajas ?? null,
          }));
        if (rows.length > 0) {
          await supabase.from("orden_productos").insert(rows);
        }
      }

      // Cargas nuevas (creadas desde cero en el modal) para el viaje nuevo.
      for (const nueva of ovsExtra) {
        const { data: creadaOV } = await supabase
          .from("ordenes_venta")
          .insert({
            viaje_id: nuevoViaje.id,
            ov_ref: (nueva.ov_ref ?? "").trim() || null,
            cliente: nueva.cliente as string,
            cedi: nueva.cedi ?? null,
            fecha_carga: nueva.fecha_carga as string,
            lugar_carga: nueva.lugar_carga as string,
            fecha_entrega: nueva.fecha_entrega ?? null,
            lugar_entrega: "",
            cita: nueva.cita ?? null,
            tiene_cita: nueva.tiene_cita ?? false,
            po: nueva.po ?? null,
            folio_cita: nueva.folio_cita ?? null,
            factura_gys: nueva.factura_gys ?? null,
            status: (nueva.status ?? "PENDIENTE") as Status,
            instrucciones: nueva.instrucciones ?? "",
          })
          .select("id")
          .single();
        if (!creadaOV) continue;
        const prods = (nueva.productos ?? [])
          .filter((p) => p && p.producto_id)
          .map((p) => ({
            orden_id: creadaOV.id,
            producto_id: p.producto_id as string,
            cajas: p.cajas ?? null,
          }));
        if (prods.length > 0) {
          await supabase.from("orden_productos").insert(prods);
        }
      }
    }

    // Ya están todas las cargas del viaje nuevo (copias + cargas nuevas): se
    // deriva su rango. Puede quedar sin fecha_fin si ninguna copia trae entrega
    // todavía, que es lo normal al rechazar — se llena al reagendarla.
    await sincronizarRangoViaje(supabase, nuevoViaje.id);

    // Transferir termógrafos seleccionados. Solo reasigna viaje_id; el filtro
    // viaje_id=origen hace que un retry no mueva de más (idempotente). No toca
    // Copeland ni corre backfill: el viaje nuevo empieza desde cero.
    const termoIds: string[] = Array.isArray(body.termografo_ids)
      ? body.termografo_ids.filter(Boolean)
      : [];
    if (termoIds.length > 0) {
      const { data: moved } = await supabase
        .from("termografos")
        .update({ viaje_id: nuevoViaje.id })
        .in("id", termoIds)
        .eq("viaje_id", params.id)
        .eq("asignado", true)
        .eq("deshabilitado", false)
        .select("id");
      transferidos = (moved ?? []).map((t) => t.id as string);
    }

    // Al asignar termógrafo(s) al viaje nuevo, sus cargas copiadas (Pendiente)
    // pasan a En tránsito (mismo criterio que cualquier viaje nuevo).
    if (transferidos.length > 0) {
      await ponerOVsEnTransitoAlAsignar(supabase, nuevoViaje.id, transferidos);
    }

    // Auditoría del viaje nuevo.
    const descNuevo = [
      `Creó viaje #${String(nuevoViaje.numero).padStart(4, "0")} desde rechazo del viaje #${String(
        viajeOrigen.numero
      ).padStart(4, "0")}`,
      ...transferidos.map(
        (tid) =>
          `Transfirió termógrafo ${tid} desde viaje #${String(viajeOrigen.numero).padStart(4, "0")}`
      ),
      ...(ovsExtra.length > 0 ? [`Agregó ${ovsExtra.length} carga(s) nueva(s) al viaje`] : []),
    ];
    await logAuditMany(supabase, { viaje_id: nuevoViaje.id, tipo: "CREACION" }, descNuevo);
  }

  // Rechazo PARCIAL: la carga conserva su status y sus cajas cargadas; solo se
  // anota cuántas se rechazaron por línea. Así no se pierde cuánto se cargó, y
  // el rechazo queda escrito aunque no se haya creado viaje nuevo (merma).
  const idsParciales = rechazablesIds.filter((rid) => parciales[rid]);
  for (const rid of idsParciales) {
    const detalle = parciales[rid];
    for (const [lineaId, cajas] of Object.entries(detalle)) {
      const n = Number(cajas);
      if (!Number.isFinite(n) || n <= 0) continue;
      await supabase
        .from("orden_productos")
        .update({ cajas_rechazadas: n })
        .eq("id", lineaId)
        .eq("orden_id", rid);
    }
    await supabase
      .from("ordenes_venta")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", rid);
  }

  // Rechazo TOTAL: la carga sí pasa a RECHAZO_CALIDAD (idempotente).
  const idsTotales = rechazablesIds.filter((rid) => !parciales[rid]);
  if (idsTotales.length > 0) {
    await supabase
      .from("ordenes_venta")
      .update({ status: "RECHAZO_CALIDAD", updated_at: new Date().toISOString() })
      .in("id", idsTotales)
      .eq("viaje_id", params.id);
  }

  // Auditoría. Los totales llevan el prefijo estándar de cambio de status para que
  // la pestaña Rechazados pueda ordenar por cuándo se rechazó (misma fuente que el
  // PATCH de OV). Los parciales NO cambian de status, así que se anotan aparte con
  // el conteo de cajas.
  const descRechazo = rechazables.map((o) => {
    const id = o.id as string;
    const ref = o.ov_ref ?? "(sin ref)";
    const detalle = parciales[id];
    if (detalle) {
      const total = Object.values(detalle).reduce((n, c) => n + (Number(c) || 0), 0);
      return `Rechazo parcial de OV ${ref}: ${total} caja(s)`;
    }
    return `${STATUS_CHANGE_AUDIT_PREFIX} ${ref} de ${statusLabel(o.status)} a ${statusLabel("RECHAZO_CALIDAD")}`;
  });
  const transferNota = transferidos.length > 0 && nuevoViaje
    ? [`Transfirió ${transferidos.length} termógrafo(s) al viaje #${String(nuevoViaje.numero).padStart(4, "0")}`]
    : [];
  await logAuditMany(
    supabase,
    { viaje_id: params.id, tipo: "MODIFICACION" },
    [...descRechazo, ...transferNota]
  );

  return NextResponse.json({
    ok: true,
    rechazadas: rechazablesIds,
    nuevo_viaje: nuevoViaje,
    termografos_transferidos: transferidos,
  });
}
