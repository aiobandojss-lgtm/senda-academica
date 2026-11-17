import { type Context, Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
import { bogotaAUtc } from "../dominio/fechas";
import { idDeRuta, responderError, validarJson } from "../errores";
import { accesoDenegado } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { conCambios, MENSAJE_SIN_CAMBIOS, texto } from "../validacion";
import { type ActividadConAcceso, actividadVisible, cursoVisible, esDocenteDelCurso } from "./acceso";

// Actividades (talleres y evaluaciones) por curso (spec `actividades-entregas`, "Publicación de actividades"
// y "Edición de actividades"). El docente del curso las crea y edita; el estudiante ve solo las publicadas.

// Rutas que cuelgan de un curso: /api/cursos/:id/actividades
export const actividadesDeCurso = new Hono<AppEnv>();
// Rutas de una actividad: /api/actividades/:id
export const actividades = new Hono<AppEnv>();

const MENSAJE_FECHA = "Escribe la fecha límite con fecha y hora, por ejemplo 2026-11-23T23:59";
// El docente la escribe en hora de Colombia; se guarda en UTC (D9, D20)
const fechaLimite = z
  .string({ error: MENSAJE_FECHA })
  .trim()
  .transform((valor, ctx) => {
    const utc = bogotaAUtc(valor);
    if (!utc) {
      ctx.addIssue({ code: "custom", message: MENSAJE_FECHA });
      return z.NEVER;
    }
    return utc;
  });
const tipo = z.enum(["taller", "evaluacion"], { error: "Elige el tipo de actividad: taller o evaluación" });
const titulo = texto("Escribe el título de la actividad", 150, "El título");
const instrucciones = texto("Escribe las instrucciones de la actividad", 5000, "Las instrucciones");
const publicada = z.boolean({ error: "El estado de publicación debe ser verdadero o falso" });

const esquemaCrear = z.object({ tipo, titulo, instrucciones, fechaLimite, publicada: publicada.optional() });
const esquemaEditar = z
  .object({
    tipo: tipo.optional(),
    titulo: titulo.optional(),
    instrucciones: instrucciones.optional(),
    fechaLimite: fechaLimite.optional(),
    publicada: publicada.optional(),
  })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);

// Formato del archivo de apoyo, tomado de su llave (apoyos/<actividad>/<uuid>.<ext>, D7)
const formatoDe = (llave: string | null) => (llave ? (llave.split(".").pop() ?? "") : null);

// Proyección común. La fecha límite sale en UTC (D9); la interfaz la muestra en hora de Colombia.
export const aActividad = (a: Omit<ActividadConAcceso, "docente_id">) => ({
  id: a.id,
  cursoId: a.curso_id,
  tipo: a.tipo,
  titulo: a.titulo,
  instrucciones: a.instrucciones,
  fechaLimite: a.fecha_limite,
  publicada: a.publicada === 1,
  apoyo: a.archivo_apoyo_key ? { formato: formatoDe(a.archivo_apoyo_key) } : null,
});

// Estado de la entrega de un estudiante (spec "Seguimiento de entregas" y "Entregas tardías", D20):
// "tardía" se calcula comparando fechas, nunca se guarda
type FilaEntrega = {
  entrega_id: number | null;
  entregado_en: string | null;
  nota: number | null;
  comentario: string | null;
  nombre_archivo: string | null;
  fecha_limite: string;
};
export function aEntrega(f: FilaEntrega) {
  const tardia = f.entregado_en !== null && f.entregado_en > f.fecha_limite;
  const estado = f.entrega_id === null ? "sin_entregar" : f.nota !== null ? "calificada" : tardia ? "tardia" : "entregada";
  return {
    id: f.entrega_id,
    estado,
    tardia,
    entregadoEn: f.entregado_en,
    nombreArchivo: f.nombre_archivo,
    nota: f.nota,
    comentario: f.comentario,
  };
}

const COLUMNAS = "a.id, a.curso_id, a.tipo, a.titulo, a.instrucciones, a.fecha_limite, a.archivo_apoyo_key, a.publicada";

// Vista del estudiante: actividad publicada más su propia entrega
async function vistaEstudiante(db: D1Database, estudianteId: number, filtro: { cursoId: number } | { actividadId: number }) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS}, e.id AS entrega_id, e.entregado_en, e.nota, e.comentario, e.nombre_archivo
         FROM actividades a
         LEFT JOIN entregas e ON e.actividad_id = a.id AND e.estudiante_id = ?
        WHERE a.publicada = 1 AND ${"cursoId" in filtro ? "a.curso_id" : "a.id"} = ?
        ORDER BY a.fecha_limite, a.id`,
    )
    .bind(estudianteId, "cursoId" in filtro ? filtro.cursoId : filtro.actividadId)
    .all<Omit<ActividadConAcceso, "docente_id"> & FilaEntrega>();
  return results.map((f) => ({ ...aActividad(f), entrega: aEntrega(f) }));
}

// Vista del docente y del administrador: todas, con cuántos entregaron y cuántas están calificadas
export async function vistaDocente(db: D1Database, filtro: { cursoId: number } | { actividadId: number }) {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS},
         (SELECT COUNT(*) FROM entregas e WHERE e.actividad_id = a.id) AS entregas,
         (SELECT COUNT(*) FROM entregas e WHERE e.actividad_id = a.id AND e.nota IS NOT NULL) AS calificadas,
         (SELECT COUNT(*) FROM inscripciones i JOIN usuarios u ON u.id = i.estudiante_id AND u.activo = 1
           WHERE i.curso_id = a.curso_id) AS inscritos
         FROM actividades a
        WHERE ${"cursoId" in filtro ? "a.curso_id" : "a.id"} = ?
        ORDER BY a.fecha_limite, a.id`,
    )
    .bind("cursoId" in filtro ? filtro.cursoId : filtro.actividadId)
    .all<Omit<ActividadConAcceso, "docente_id"> & { entregas: number; calificadas: number; inscritos: number }>();
  return results.map((f) => ({ ...aActividad(f), entregas: f.entregas, calificadas: f.calificadas, inscritos: f.inscritos }));
}

const vistaSegunRol = (c: Context<AppEnv>, filtro: { cursoId: number } | { actividadId: number }) =>
  c.var.usuario.rol === "estudiante" ? vistaEstudiante(c.env.DB, c.var.usuario.id, filtro) : vistaDocente(c.env.DB, filtro);

actividadesDeCurso.get("/:id/actividades", async (c) => {
  const curso = await cursoVisible(c, idDeRuta(c));
  if (curso instanceof Response) return curso;
  return c.json(await vistaSegunRol(c, { cursoId: curso.id }));
});

actividadesDeCurso.post("/:id/actividades", validarJson(esquemaCrear), async (c) => {
  const curso = await cursoVisible(c, idDeRuta(c));
  if (curso instanceof Response) return curso;
  if (!esDocenteDelCurso(c, curso.docente_id)) return accesoDenegado(c);

  const datos = c.req.valid("json");
  const creada = await c.env.DB.prepare(
    "INSERT INTO actividades (curso_id, tipo, titulo, instrucciones, fecha_limite, publicada) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(curso.id, datos.tipo, datos.titulo, datos.instrucciones, datos.fechaLimite, datos.publicada ? 1 : 0)
    .first<{ id: number }>();
  const [actividad] = await vistaDocente(c.env.DB, { actividadId: creada!.id });
  return c.json(actividad, 201);
});

// Inicio del estudiante (tarea 4.4): actividades publicadas sin entregar de sus cursos actuales, por fecha
// límite (también las vencidas: todavía puede entregarlas como tardías), y su avance. Va antes de "/:id"
// para que "pendientes" no se tome como un id.
actividades.get("/pendientes", async (c) => {
  const usuario = c.var.usuario;
  if (usuario.rol !== "estudiante") return accesoDenegado(c);
  const { results } = await c.env.DB.prepare(
    `SELECT ${COLUMNAS}, k.nombre AS curso_nombre, en.id AS entrega_id
       FROM actividades a
       JOIN cursos k ON k.id = a.curso_id AND k.activo = 1
       JOIN inscripciones i ON i.curso_id = k.id AND i.estudiante_id = ?
       JOIN estudiantes e ON e.usuario_id = i.estudiante_id AND e.semestre_actual = k.semestre AND e.carrera_id = k.carrera_id
       LEFT JOIN entregas en ON en.actividad_id = a.id AND en.estudiante_id = i.estudiante_id
      WHERE a.publicada = 1
      ORDER BY a.fecha_limite, a.id`,
  )
    .bind(usuario.id)
    .all<Omit<ActividadConAcceso, "docente_id"> & { curso_nombre: string; entrega_id: number | null }>();
  const pendientes = results.filter((f) => f.entrega_id === null);
  return c.json({
    pendientes: pendientes.map((f) => ({ ...aActividad(f), curso: { id: f.curso_id, nombre: f.curso_nombre } })),
    publicadas: results.length,
    entregadas: results.length - pendientes.length,
  });
});

actividades.get("/:id", async (c) => {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  const [vista] = await vistaSegunRol(c, { actividadId: actividad.id });
  return c.json(vista);
});

actividades.patch("/:id", validarJson(esquemaEditar), async (c) => {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  if (!esDocenteDelCurso(c, actividad.docente_id)) return accesoDenegado(c);
  const datos = c.req.valid("json");

  // Volver a borrador solo sin entregas (spec "Edición de actividades")
  if (datos.publicada === false && actividad.publicada === 1) {
    const { total } = (await c.env.DB.prepare("SELECT COUNT(*) AS total FROM entregas WHERE actividad_id = ?")
      .bind(actividad.id)
      .first<{ total: number }>())!;
    if (total > 0) {
      return responderError(c, 409, "ACTIVIDAD_CON_ENTREGAS", "Esta actividad ya tiene entregas: no puede volver a borrador");
    }
  }

  await actualizar(c.env.DB, "actividades", actividad.id, {
    tipo: datos.tipo,
    titulo: datos.titulo,
    instrucciones: datos.instrucciones,
    fecha_limite: datos.fechaLimite,
    publicada: datos.publicada,
  })?.run();
  const [vista] = await vistaDocente(c.env.DB, { actividadId: actividad.id });
  return c.json(vista);
});

// Seguimiento de entregas (spec "Seguimiento de entregas", D18): para el docente del curso o el
// administrador, cada estudiante del curso con el estado de su entrega. Solo nombres y apellidos: nunca
// documento, correo ni celular. Son los activos, más cualquier retirado que alcanzó a entregar.
actividades.get("/:id/entregas", async (c) => {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  if (c.var.usuario.rol === "estudiante") return accesoDenegado(c);

  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.nombres, u.apellidos,
            e.id AS entrega_id, e.entregado_en, e.nota, e.comentario, e.nombre_archivo, a.fecha_limite
       FROM actividades a
       JOIN inscripciones i ON i.curso_id = a.curso_id
       JOIN usuarios u ON u.id = i.estudiante_id
       LEFT JOIN entregas e ON e.actividad_id = a.id AND e.estudiante_id = u.id
      WHERE a.id = ? AND (u.activo = 1 OR e.id IS NOT NULL)
      ORDER BY u.apellidos, u.nombres`,
  )
    .bind(actividad.id)
    .all<{ id: number; nombres: string; apellidos: string } & FilaEntrega>();
  return c.json(
    results.map((f) => ({ estudiante: { id: f.id, nombres: f.nombres, apellidos: f.apellidos }, entrega: aEntrega(f) })),
  );
});
