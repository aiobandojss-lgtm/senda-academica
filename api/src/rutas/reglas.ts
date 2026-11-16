import type { Context } from "hono";
import { responderError } from "../errores";
import type { AppEnv } from "../tipos";

// Reglas de asignación compartidas por cursos y estudiantes (spec `carreras-estudiantes`). Cada una
// devuelve la respuesta de error, o null si se cumple.

// Carrera que existe, que está activa (si es una asignación nueva) y en la que cabe el semestre
export async function errorDeCarrera(
  c: Context<AppEnv>,
  carreraId: number,
  semestre: number,
  { exigirActiva }: { exigirActiva: boolean },
) {
  const carrera = await c.env.DB.prepare("SELECT codigo, duracion_semestres, activa FROM carreras WHERE id = ?")
    .bind(carreraId)
    .first<{ codigo: string; duracion_semestres: number; activa: number }>();
  if (!carrera) return responderError(c, 404, "CARRERA_NO_ENCONTRADA", "La carrera no existe");
  if (exigirActiva && carrera.activa !== 1) {
    return responderError(c, 409, "CARRERA_INACTIVA", `La carrera ${carrera.codigo} no está activa`);
  }
  if (semestre > carrera.duracion_semestres) {
    return responderError(
      c,
      400,
      "SEMESTRE_FUERA_DE_CARRERA",
      `La carrera ${carrera.codigo} tiene semestres del 1 al ${carrera.duracion_semestres}`,
    );
  }
  return null;
}

// Solo un docente activo puede asignarse a un curso
export async function errorDeDocente(c: Context<AppEnv>, docenteId: number) {
  const docente = await c.env.DB.prepare("SELECT activo FROM usuarios WHERE id = ? AND rol = 'docente'")
    .bind(docenteId)
    .first<{ activo: number }>();
  if (!docente) return responderError(c, 404, "DOCENTE_NO_ENCONTRADO", "El docente no existe");
  if (docente.activo !== 1) {
    return responderError(c, 409, "DOCENTE_INACTIVO", "El docente no está activo: reactívalo o elige otro");
  }
  return null;
}

// El documento es único entre TODOS los usuarios: es el usuario para ingresar
export const documentoRepetido = (c: Context<AppEnv>, documento: string) =>
  responderError(c, 409, "DOCUMENTO_REPETIDO", `Ya existe un usuario con el documento ${documento}`);
