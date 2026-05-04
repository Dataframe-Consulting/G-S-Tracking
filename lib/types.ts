export type Status =
  | "PENDIENTE"
  | "EN_PREPARACION"
  | "TRANSITO"
  | "ENTREGADO"
  | "RECIBIDO"
  | "RECHAZO_CALIDAD";

export const STATUS_VALUES: Status[] = [
  "PENDIENTE",
  "EN_PREPARACION",
  "TRANSITO",
  "ENTREGADO",
  "RECIBIDO",
  "RECHAZO_CALIDAD"
];

export const STATUS_LABELS: Record<Status, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  TRANSITO: "En tránsito",
  ENTREGADO: "Entregado",
  RECIBIDO: "Recibido",
  RECHAZO_CALIDAD: "Rechazo calidad"
};

export const STATUS_CLASSES: Record<Status, string> = {
  PENDIENTE: "bg-slate-200 text-slate-800",
  EN_PREPARACION: "bg-blue-100 text-blue-800",
  TRANSITO: "bg-amber-100 text-amber-800",
  ENTREGADO: "bg-emerald-100 text-emerald-800",
  RECIBIDO: "bg-emerald-200 text-emerald-900",
  RECHAZO_CALIDAD: "bg-red-100 text-red-800"
};

export interface Producto {
  id: string;
  nombre: string;
  temp_min: number;
  temp_max: number;
}

export interface ProductoCombinacion {
  id: string;
  producto_a_id: string;
  producto_b_id: string;
  temp_min: number;
  temp_max: number;
  producto_a: { id: string; nombre: string };
  producto_b: { id: string; nombre: string };
}

export interface OrdenVenta {
  id: string;
  viaje_id: string;
  ov_ref: string;
  cliente: string;
  fecha_carga: string;
  lugar_carga: string;
  fecha_entrega: string;
  lugar_entrega: string;
  cita: string | null;
  status: Status;
  instrucciones: string;
  producto_id: string | null;
  producto_combinacion_id: string | null;
  cajas: number | null;
  cajas_b: number | null;
  created_at: string;
  updated_at: string;
  producto?: Producto | null;
  combo?: ProductoCombinacion | null;
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
  temp_actual: number | null;
  lat: number | null;
  lng: number | null;
  ultima_lectura: string | null;
  alerta_activa: boolean;
  created_at: string;
  updated_at: string;
  ordenes_venta?: OrdenVenta[];
  responsable?: Responsable | null;
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

export interface Cliente {
  id: string;
  nombre: string;
  contacto: string | null;
  created_at: string;
}

export interface Transportista {
  id: string;
  nombre: string;
  contacto: string | null;
  created_at: string;
}
