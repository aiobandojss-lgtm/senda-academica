import { type Context, Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
import { inscribirEnCurso } from "../dominio/inscripciones";
import { idDeRuta, responderError, validarJson } from "../errores";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { conCambios, MENSAJE_SIN_CAMBIOS, texto } from "../validacion";

// Cursos por carrera (spec `carreras-estudiantes`, design.md D15 y D18). El administrador los crea y
// edita; el docente consulta solo los suyos.
export const cursos = new Hono<AppEnv>();

const entero = (mensaje: string) => z.number({ error: mensaje }).int(mensaje).positive(mensaje);
const nombre = texto("Escribe el nombre del curso", 120, "El nombre");

const esquemaCrear = z.object({
  carreraId: entero("Elige la carrera del curso"),
  nombre,
  semestre: entero("Escribe el semestre del curso"),
  docenteId: entero("Elige el docente del curso"),
});

// La carrera y el semestre no se editan (spec "Edición de cursos", D15): cambiarlos dejaría inscritos
// a estudiantes de otro semestre, porque las inscripciones nunca se borran solas
const NO_EDITABLE = "La carrera y el semestre de un curso no se pueden cambiar: desactívalo y crea otro";
const esquemaEditar = z
  .object({
    nombre: nombre.optional(),
    docenteId: entero("Elige el docente del curso").optional(),
    activo: z.boolean({ error: "El estado del curso debe ser verdadero o falso" }).optional(),
    carreraId: z.never({ error: NO_EDITABLE }).optional(),
    semestre: z.never({ error: NO_EDITABLE }).optional(),
  })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);

type FilaCurso = {
  id: number;
  nombre: string;
  semestre: number;
  activo: number;
  carrera_id: number;
  carrera_codigo: string;
  carrera_nombre: string;
  docente_id: number | null;
  docente_nombres: string | null;
  docente_apellidos: string | null;
  docente_activo: number | null;
  inscritos: number;
};

// "inscritos" cuenta solo estudiantes activos: un retirado conserva su inscripción (historial), pero no
// es parte del grupo actual
const SELECT_CURSO = `
  SELECT k.id, k.nombre, k.semestre, k.activo,
    c.id AS carrera_id, c.codigo AS carrera_codigo, c.nombre AS carrera_nombre,
    d.id AS docente_id, d.nombres AS docente_nombres, d.apellidos AS docente_apellidos, d.activo AS docente_activo,
    (SELECT COUNT(*) FROM inscripciones i JOIN usuarios u ON u.id = i.estudiante_id AND u.activo = 1
      WHERE i.curso_id = k.id) AS inscritos
  FROM cursos k
  JOIN carreras c ON c.id = k.carrera_id
  LEFT JOIN usuarios d ON d.id = k.docente_id`;
const ORDEN = "ORDER BY c.nombre, k.semestre, k.nombre";

const carreraDe = (f: FilaCurso) => ({ id: f.carrera_id, codigo: f.carrera_codigo, nombre: f.carrera_nombre });

// Proyecciones por rol (D18): el administrador ve el docente y el estado; el docente, solo lo de su curso
const aCursoAdmin = (f: FilaCurso) => ({
  id: f.id,
  nombre: f.nombre,
  semestre: f.semestre,
  activo: f.activo === 1,
  carrera: carreraDe(f),
  docente:
    f.docente_id === null
      ? null
      : { id: f.docente_id, nombres: f.docente_nombres, apellidos: f.docente_apellidos, activo: f.docente_activo === 1 },
  inscritos: f.inscritos,
});
const aCursoDocente = (f: FilaCurso) => ({
  id: f.id,
  nombre: f.nombre,
  semestre: f.semestre,
  carrera: carreraDe(f),
  inscritos: f.inscritos,
});

const buscarCurso = (db: D1Database, id: number) => db.prepare(`${SELECT_CURSO} WHERE k.id = ?`).bind(id).first<FilaCurso>();

// Solo un docente activo puede asignarse a un curso (spec "Cursos por carrera")
async function errorDeDocente(c: Context<AppEnv>, docenteId: number) {
  const docente = await c.env.DB.prepare("SELECT activo FROM usuarios WHERE id = ? AND rol = 'docente'")
    .bind(docenteId)
    .first<{ activo: number }>();
  if (!docente) return responderError(c, 404, "DOCENTE_NO_ENCONTRADO", "El docente no existe");
  if (docente.activo !== 1) {
    return responderError(c, 409, "DOCENTE_INACTIVO", "El docente no está activo: reactívalo o elige otro");
  }
  return null;
}

const carreraInactiva = (c: Context<AppEnv>, codigo: string) =>
  responderError(c, 409, "CARRERA_INACTIVA", `La carrera ${codigo} no está activa`);

cursos.get("/", requiereRol("admin", "docente"), async (c) => {
  const usuario = c.var.usuario;
  if (usuario.rol === "docente") {
    const { results } = await c.env.DB.prepare(`${SELECT_CURSO} WHERE k.docente_id = ? AND k.activo = 1 ${ORDEN}`)
      .bind(usuario.id)
      .all<FilaCurso>();
    return c.json(results.map(aCursoDocente));
  }

  const carrera = c.req.query("carrera");
  const carreraId = carrera === undefined ? null : Number(carrera);
  if (carreraId !== null && !(Number.isSafeInteger(carreraId) && carreraId > 0)) {
    return responderError(c, 400, "SOLICITUD_INVALIDA", "El filtro de carrera no es válido");
  }
  const consulta =
    carreraId === null
      ? c.env.DB.prepare(`${SELECT_CURSO} ${ORDEN}`)
      : c.env.DB.prepare(`${SELECT_CURSO} WHERE k.carrera_id = ? ${ORDEN}`).bind(carreraId);
  const { results } = await consulta.all<FilaCurso>();
  return c.json(results.map(aCursoAdmin));
});

cursos.post("/", requiereRol("admin"), validarJson(esquemaCrear), async (c) => {
  const datos = c.req.valid("json");

  const carrera = await c.env.DB.prepare("SELECT codigo, duracion_semestres, activa FROM carreras WHERE id = ?")
    .bind(datos.carreraId)
    .first<{ codigo: string; duracion_semestres: number; activa: number }>();
  if (!carrera) return responderError(c, 404, "CARRERA_NO_ENCONTRADA", "La carrera no existe");
  if (carrera.activa !== 1) return carreraInactiva(c, carrera.codigo);
  if (datos.semestre > carrera.duracion_semestres) {
    return responderError(
      c,
      400,
      "SEMESTRE_FUERA_DE_CARRERA",
      `La carrera ${carrera.codigo} tiene semestres del 1 al ${carrera.duracion_semestres}`,
    );
  }
  const errorDocente = await errorDeDocente(c, datos.docenteId);
  if (errorDocente) return errorDocente;

  // D15: el curso y sus inscripciones en un solo batch (una transacción): o se guardan ambos o ninguno
  const [creado] = await c.env.DB.batch<{ id: number }>([
    c.env.DB.prepare("INSERT INTO cursos (carrera_id, nombre, semestre, docente_id) VALUES (?, ?, ?, ?) RETURNING id").bind(
      datos.carreraId,
      datos.nombre,
      datos.semestre,
      datos.docenteId,
    ),
    inscribirEnCurso(c.env.DB, null),
  ]);
  const id = creado.results[0].id;
  return c.json(aCursoAdmin((await buscarCurso(c.env.DB, id))!), 201);
});

cursos.patch("/:id", requiereRol("admin"), validarJson(esquemaEditar), async (c) => {
  const id = idDeRuta(c);
  const actual = id ? await buscarCurso(c.env.DB, id) : null;
  if (!id || !actual) return responderError(c, 404, "CURSO_NO_ENCONTRADO", "El curso no existe");
  const datos = c.req.valid("json");

  if (datos.docenteId !== undefined) {
    const errorDocente = await errorDeDocente(c, datos.docenteId);
    if (errorDocente) return errorDocente;
  }

  // Reactivar: misma regla que al crear (carrera activa) y misma inscripción automática (D15)
  const reactiva = datos.activo === true && actual.activo !== 1;
  if (reactiva) {
    const carrera = await c.env.DB.prepare("SELECT activa FROM carreras WHERE id = ?").bind(actual.carrera_id).first<{ activa: number }>();
    if (carrera?.activa !== 1) return carreraInactiva(c, actual.carrera_codigo);
  }

  const sentencias = [
    actualizar(c.env.DB, "cursos", id, { nombre: datos.nombre, docente_id: datos.docenteId, activo: datos.activo }),
    reactiva ? inscribirEnCurso(c.env.DB, id) : null,
  ].filter((s): s is D1PreparedStatement => s !== null);
  await c.env.DB.batch(sentencias);

  return c.json(aCursoAdmin((await buscarCurso(c.env.DB, id))!));
});
