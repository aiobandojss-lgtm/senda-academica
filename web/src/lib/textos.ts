import type { EstadoCartera, TipoDocumento } from "./consultas";

// Textos de la interfaz para los valores del dominio

export const TEXTO_ESTADO_CARTERA: Record<EstadoCartera, string> = {
  al_dia: "Al día",
  en_riesgo: "En riesgo",
  bloqueado: "Bloqueado",
  con_excepcion: "Con excepción",
};

// Igual que el CHECK de usuarios.tipo_documento (migrations/0001_inicial.sql)
export const TIPOS_DOCUMENTO: { valor: TipoDocumento; texto: string }[] = [
  { valor: "CC", texto: "Cédula de ciudadanía (CC)" },
  { valor: "TI", texto: "Tarjeta de identidad (TI)" },
  { valor: "CE", texto: "Cédula de extranjería (CE)" },
  { valor: "PPT", texto: "Permiso por protección temporal (PPT)" },
  { valor: "PA", texto: "Pasaporte (PA)" },
];
