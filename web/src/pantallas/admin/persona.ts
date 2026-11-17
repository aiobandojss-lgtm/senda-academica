import type { TipoDocumento } from "@/lib/consultas";

// Datos personales que comparten docentes y estudiantes en los formularios (spec `carreras-estudiantes`)
export type DatosPersona = {
  tipoDocumento: TipoDocumento;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string;
};

export const PERSONA_VACIA: DatosPersona = { tipoDocumento: "CC", documento: "", nombres: "", apellidos: "", correo: "", celular: "" };

// Lo que se edita de una persona que ya existe (el celular vacío se envía como "": la API lo guarda como NULL)
export const datosDe = (p: Omit<DatosPersona, "celular"> & { celular: string | null }): DatosPersona => ({
  tipoDocumento: p.tipoDocumento,
  documento: p.documento,
  nombres: p.nombres,
  apellidos: p.apellidos,
  correo: p.correo,
  celular: p.celular ?? "",
});
