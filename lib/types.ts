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

export interface Carga {
  id: string;
  fecha_carga: string;
  fecha_entrega: string;
  cita: string | null;
  cliente: string;
  ov_ref: string;
  lugar_carga: string;
  producto_descripcion: string;
  producto_id: string | null;
  status: Status;
  flete_cargo: string | null;
  termografo_id: string | null;
  temp_actual: number | null;
  lat: number | null;
  lng: number | null;
  ultima_lectura: string | null;
  alerta_activa: boolean;
  created_at: string;
  updated_at: string;
  producto?: Producto | null;
}

export interface LecturaTemperatura {
  id: string;
  carga_id: string;
  termografo_id: string;
  temperatura: number;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  fuera_rango: boolean;
}

export interface AlertaLog {
  id: string;
  carga_id: string;
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
  carga_id: string | null;
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
