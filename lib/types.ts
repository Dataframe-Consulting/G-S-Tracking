export type Status =
  | "PENDIENTE"
  | "EN_PREPARACION"
  | "TRANSITO"
  | "ENTREGADO"
  | "RECHAZO_CALIDAD";

export const STATUS_VALUES: Status[] = [
  "PENDIENTE",
  "EN_PREPARACION",
  "TRANSITO",
  "ENTREGADO",
  "RECHAZO_CALIDAD"
];

export const STATUS_LABELS: Record<Status, string> = {
  PENDIENTE: "Pendiente de carga",
  EN_PREPARACION: "Proceso de carga",
  TRANSITO: "En tránsito",
  ENTREGADO: "Entregado",
  RECHAZO_CALIDAD: "Rechazo"
};

// Pastilla (badge) de status: fondo + texto. Esquema: pendiente gris, proceso de
// carga naranja, en tránsito verde, entregado azul, rechazo rojo.
export const STATUS_CLASSES: Record<Status, string> = {
  PENDIENTE: "bg-slate-100 text-slate-700",
  EN_PREPARACION: "bg-orange-100 text-orange-800",
  TRANSITO: "bg-emerald-100 text-emerald-800",
  ENTREGADO: "bg-blue-100 text-blue-800",
  RECHAZO_CALIDAD: "bg-red-100 text-red-800"
};

// Color sólido del punto/círculo de status, para indicadores compactos en tablas
// (mismo esquema que STATUS_CLASSES).
export const STATUS_DOT_CLASSES: Record<Status, string> = {
  PENDIENTE: "bg-slate-400",
  EN_PREPARACION: "bg-orange-500",
  TRANSITO: "bg-emerald-500",
  ENTREGADO: "bg-blue-500",
  RECHAZO_CALIDAD: "bg-red-500"
};

export interface Producto {
  id: string;
  nombre: string;
  /** Rango del catálogo al que pertenece el producto (Fase 2-3). Un producto → un rango.
   *  Los productos ya NO tienen temperatura propia (Fase 4): el rango lo define el viaje. */
  rango_id?: string | null;
}

export interface RangoTemperatura {
  id: string;
  temp_min: number;
  temp_max: number;
  created_at: string;
  /** Productos asignados a este rango (productos.rango_id = este.id) */
  productos?: Producto[];
}

// Un producto dentro de una OV (Fase 5: N productos por OV, cada uno con cajas).
export interface OrdenProducto {
  id: string;
  orden_id?: string;
  producto_id: string | null;
  cajas: number | null;
  producto?: { id: string; nombre: string } | null;
}

export interface OrdenVenta {
  id: string;
  viaje_id: string;
  ov_ref: string;
  cliente: string;
  fecha_carga: string;
  lugar_carga: string;
  fecha_entrega: string | null;
  lugar_entrega: string;
  cita: string | null;
  tiene_cita: boolean;
  po: string | null;
  folio_cita: string | null;
  factura_gys: string | null;
  status: Status;
  instrucciones: string;
  cedi: string | null;
  created_at: string;
  updated_at: string;
  /** Productos de la OV (Fase 5). Reemplaza producto/combo + cajas/cajas_b. */
  productos?: OrdenProducto[];
}

export interface Responsable {
  id: string;
  nombre: string | null;
  email: string | null;
}

export interface Viaje {
  id: string;
  numero: number;
  lugar_inicio: string;
  lugar_fin: string;
  fecha_inicio: string;
  fecha_fin: string;
  flete_cargo: string | null;
  termografo_id: string | null;
  responsable_id: string | null;
  linea_transportista_id: string | null;
  operador: string | null;
  modelo: string | null;
  anio: string | null;
  placas_tracto: string | null;
  placas_caja: string | null;
  contacto_unidad: string | null;
  ubicacion_ciudad: string | null;
  ubicacion_estado: string | null;
  ubicacion_pais: string | null;
  ubicacion_geo_key: string | null;
  /** Rango propio del viaje (si está definido, manda sobre los productos de las OVs) */
  temp_min: number | null;
  temp_max: number | null;
  /** Rango del catálogo que usa el viaje (modo "Catálogo"); copia su min/max a temp_min/max */
  temp_rango_id?: string | null;
  temp_actual: number | null;
  /** Calculado (no en BD): promedio de la última lectura de cada termógrafo asignado */
  temp_carga?: number | null;
  /** Calculado (no en BD): fecha del último cambio de status, derivado de auditoría.
   *  Usado para ordenar Completados/Rechazados por cuándo concluyó el viaje. */
  concluido_at?: string | null;
  lat: number | null;
  lng: number | null;
  ultima_lectura: string | null;
  alerta_activa: boolean;
  created_at: string;
  updated_at: string;
  ordenes_venta?: OrdenVenta[];
  responsable?: Responsable | null;
  termografos?: Termografo[];
  linea?: {
    id: string;
    nombre: string;
    concesionario?: { id: string; nombre: string } | null;
  } | null;
}

export interface LecturaTemperatura {
  id: string;
  viaje_id: string;
  termografo_id: string;
  temperatura: number;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  fuera_rango: boolean;
}

export interface AlertaLog {
  id: string;
  viaje_id: string;
  tipo: "TEMP_ALTA" | "TEMP_BAJA";
  temperatura: number | null;
  mensaje: string | null;
  whatsapp_sid: string | null;
  enviado_a: string | null;
  created_at: string;
}

export interface Termografo {
  id: string;
  nombre: string | null;
  asignado: boolean;
  viaje_id: string | null;
  ultima_actividad: string | null;
  /** Cambio 1: termógrafo deshabilitado (deja de leer/promediar/alertar) pero
   *  conserva su vínculo con el viaje y su historial. No se puede reactivar. */
  deshabilitado: boolean;
}

export type Role = "master" | "operador" | "visor";

export const ROLE_LABELS: Record<Role, string> = {
  master: "Master",
  operador: "Operador",
  visor: "Visor"
};

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  nombre: string | null;
  created_at: string;
}

export interface Cedi {
  id: string;
  cliente_id: string;
  nombre: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  contacto: string | null;
  created_at: string;
  cedis?: Cedi[];
}

export interface Transportista {
  id: string;
  nombre: string;
  contacto: string | null;
  created_at: string;
}

export interface LineaTransportista {
  id: string;
  concesionario_id: string;
  nombre: string;
  created_at: string;
}

export interface Concesionario {
  id: string;
  nombre: string;
  created_at: string;
  lineas_transportista?: LineaTransportista[];
}

export interface Auditoria {
  id: string;
  viaje_id: string | null;
  ov_id: string | null;
  user_id: string | null;
  user_nombre: string | null;
  tipo: "CREACION" | "MODIFICACION";
  descripcion: string;
  created_at: string;
}
