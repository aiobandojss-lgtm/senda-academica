import type { Context } from "hono";
import { responderError } from "../errores";
import { accesoDenegado } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";

// Quién puede ver qué de un curso (spec `autenticacion`, "Permisos por rol", y `actividades-entregas`):
// - el administrador, todo;
// - el docente, solo los cursos que tiene asignados;
// - el estudiante, solo los cursos en que está inscrito, y de ellos solo las actividades publicadas.
// Cada función devuelve el dato o la respuesta de error lista para devolver.

export type CursoConAcceso = { id: number; docente_id: number | null; activo: number };
export type ActividadConAcceso = {
  id: number;
  curso_id: number;
  tipo: "taller" | "evaluacion";
  titulo: string;
  instrucciones: string;
  fecha_limite: string;
  archivo_apoyo_key: string | null;
  publicada: number;
  docente_id: number | null;
};

const cursoNoEncontrado = (c: Context<AppEnv>) => responderError(c, 404, "CURSO_NO_ENCONTRADO", "El curso no existe");
const actividadNoEncontrada = (c: Context<AppEnv>) => responderError(c, 404, "ACTIVIDAD_NO_ENCONTRADA", "La actividad no existe");

async function estaInscrito(db: D1Database, cursoId: number, estudianteId: number) {
  const fila = await db
    .prepare("SELECT 1 AS si FROM inscripciones WHERE curso_id = ? AND estudiante_id = ?")
    .bind(cursoId, estudianteId)
    .first<{ si: number }>();
  return fila !== null;
}

export async function cursoVisible(c: Context<AppEnv>, cursoId: number | null): Promise<CursoConAcceso | Response> {
  const curso = cursoId
    ? await c.env.DB.prepare("SELECT id, docente_id, activo FROM cursos WHERE id = ?").bind(cursoId).first<CursoConAcceso>()
    : null;
  if (!curso) return cursoNoEncontrado(c);

  const usuario = c.var.usuario;
  if (usuario.rol === "admin") return curso;
  if (usuario.rol === "docente") return curso.docente_id === usuario.id ? curso : accesoDenegado(c);
  return (await estaInscrito(c.env.DB, curso.id, usuario.id)) ? curso : accesoDenegado(c);
}

// Un borrador no existe para el estudiante: responde 404, igual que una actividad inexistente
export async function actividadVisible(c: Context<AppEnv>, actividadId: number | null): Promise<ActividadConAcceso | Response> {
  const actividad = actividadId
    ? await c.env.DB.prepare(
        `SELECT a.id, a.curso_id, a.tipo, a.titulo, a.instrucciones, a.fecha_limite, a.archivo_apoyo_key, a.publicada, k.docente_id
           FROM actividades a JOIN cursos k ON k.id = a.curso_id
          WHERE a.id = ?`,
      )
        .bind(actividadId)
        .first<ActividadConAcceso>()
    : null;
  if (!actividad) return actividadNoEncontrada(c);

  const usuario = c.var.usuario;
  if (usuario.rol === "admin") return actividad;
  if (usuario.rol === "docente") return actividad.docente_id === usuario.id ? actividad : accesoDenegado(c);
  if (actividad.publicada !== 1) return actividadNoEncontrada(c);
  return (await estaInscrito(c.env.DB, actividad.curso_id, usuario.id)) ? actividad : accesoDenegado(c);
}

// Crear y editar actividades: solo el docente asignado al curso (ni siquiera el administrador)
export const esDocenteDelCurso = (c: Context<AppEnv>, docenteId: number | null) =>
  c.var.usuario.rol === "docente" && docenteId === c.var.usuario.id;
