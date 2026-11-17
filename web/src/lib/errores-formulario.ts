import { ErrorApi } from "./api";

// Coloca cada error de la API junto al campo que lo causó (como en el cambio de contraseña, tarea 2.6):
// - Errores de validación: la API dice el campo (`campo`, tarea 3.1).
// - Errores de negocio: se reconocen por su código.
// Lo que no corresponde a un campo se muestra arriba del botón, como error general.

const CAMPO_DEL_CODIGO: Record<string, string> = {
  DOCUMENTO_REPETIDO: "documento",
  CODIGO_CARRERA_REPETIDO: "codigo",
  SEMESTRE_FUERA_DE_CARRERA: "semestre",
  CARRERA_INACTIVA: "carreraId",
  CARRERA_NO_ENCONTRADA: "carreraId",
  DOCENTE_INACTIVO: "docenteId",
  DOCENTE_NO_ENCONTRADO: "docenteId",
  DURACION_MENOR_QUE_CURSOS: "duracionSemestres",
};

export type ErroresFormulario = { campos: Record<string, string>; general: string | null };
export const SIN_ERRORES: ErroresFormulario = { campos: {}, general: null };

// `renombrar` traduce el nombre de un campo de la API al id del formulario cuando difieren
// (por ejemplo, la API dice "semestreActual" y el formulario usa "semestre")
export function erroresDe(error: unknown, renombrar: Record<string, string> = {}): ErroresFormulario {
  if (!(error instanceof ErrorApi)) {
    return { campos: {}, general: error instanceof Error ? error.message : "Ocurrió un error inesperado" };
  }
  const campo = error.campo ?? CAMPO_DEL_CODIGO[error.codigo];
  if (!campo) return { campos: {}, general: error.message };
  return { campos: { [renombrar[campo] ?? campo]: error.message }, general: null };
}
