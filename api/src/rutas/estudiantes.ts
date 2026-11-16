import { Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
import { inscribirEstudiante } from "../dominio/inscripciones";
import { ESTADOS_MORA, type EstadoMora, estadosDeCartera, hoyEnBogota } from "../dominio/mora";
import { esUnicoRepetido, idDeRuta, responderError, validarJson } from "../errores";
import { generarContrasenaTemporal, hashContrasena } from "../seguridad/contrasenas";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import {
  campoApellidos,
  campoCelular,
  campoCorreo,
  campoDocumento,
  campoNombres,
  campoTipoDocumento,
  conCambios,
  MENSAJE_SIN_CAMBIOS,
} from "../validacion";
import { documentoRepetido, errorDeCarrera } from "./reglas";

// Estudiantes (spec `carreras-estudiantes`, design.md D15, D17 y D18). Solo el administrador; lo que el
// docente ve de sus estudiantes está en GET /api/cursos/:id/estudiantes. La desactivación y la
// reactivación son comunes con los docentes: viven en rutas/usuarios.ts.
export const estudiantes = new Hono<AppEnv>();
estudiantes.use("*", requiereRol("admin"));

const idEntero = (mensaje: string) => z.number({ error: mensaje }).int(mensaje).positive(mensaje);
const semestre = idEntero("Escribe el semestre del estudiante");
const cohorte = z
  .string({ error: "Escribe la cohorte" })
  .trim()
  .regex(/^\d{4}-[12]$/, "La cohorte tiene la forma AAAA-1 o AAAA-2, por ejemplo 2026-2");
const fechaIngreso = z.iso.date({ error: "Escribe la fecha de ingreso como AAAA-MM-DD, por ejemplo 2026-08-03" });

const esquemaCrear = z.object({
  tipoDocumento: campoTipoDocumento,
  documento: campoDocumento,
  nombres: campoNombres,
  apellidos: campoApellidos,
  correo: campoCorreo,
  celular: campoCelular.optional(),
  carreraId: idEntero("Elige la carrera del estudiante"),
  semestre,
  cohorte,
  fechaIngreso,
});
const esquemaEditar = z
  .object({
    tipoDocumento: campoTipoDocumento.optional(),
    documento: campoDocumento.optional(),
    nombres: campoNombres.optional(),
    apellidos: campoApellidos.optional(),
    correo: campoCorreo.optional(),
    celular: campoCelular.optional(),
    carreraId: idEntero("Elige la carrera del estudiante").optional(),
    semestreActual: semestre.optional(),
    cohorte: cohorte.optional(),
    fechaIngreso: fechaIngreso.optional(),
  })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);

type FilaEstudiante = {
  id: number;
  tipo_documento: string;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string | null;
  activo: number;
  semestre_actual: number;
  cohorte: string;
  fecha_ingreso: string;
  carrera_id: number;
  carrera_codigo: string;
  carrera_nombre: string;
};

const SELECT_ESTUDIANTE = `
  SELECT u.id, u.tipo_documento, u.documento, u.nombres, u.apellidos, u.correo, u.celular, u.activo,
    e.semestre_actual, e.cohorte, e.fecha_ingreso,
    c.id AS carrera_id, c.codigo AS carrera_codigo, c.nombre AS carrera_nombre
  FROM estudiantes e
  JOIN usuarios u ON u.id = e.usuario_id
  JOIN carreras c ON c.id = e.carrera_id`;

// Proyección para el administrador (D18): datos de contacto sí, hash y campos de sesión nunca
const aEstudiante = (f: FilaEstudiante, estadoCartera: EstadoMora) => ({
  id: f.id,
  tipoDocumento: f.tipo_documento,
  documento: f.documento,
  nombres: f.nombres,
  apellidos: f.apellidos,
  correo: f.correo,
  celular: f.celular,
  activo: f.activo === 1,
  carrera: { id: f.carrera_id, codigo: f.carrera_codigo, nombre: f.carrera_nombre },
  semestreActual: f.semestre_actual,
  cohorte: f.cohorte,
  fechaIngreso: f.fecha_ingreso,
  estadoCartera,
});

async function estudianteConEstado(db: D1Database, filtro: { id: number } | { documento: string }) {
  const fila = await db
    .prepare(`${SELECT_ESTUDIANTE} WHERE ${"id" in filtro ? "u.id" : "u.documento"} = ?`)
    .bind("id" in filtro ? filtro.id : filtro.documento)
    .first<FilaEstudiante>();
  if (!fila) return null;
  const estadoDe = await estadosDeCartera(db, hoyEnBogota(), fila.id);
  return aEstudiante(fila, estadoDe(fila.id));
}

// Para buscar sin importar tildes ni mayúsculas: "MUNOZ" encuentra "Muñoz"
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Búsqueda por nombre o documento y filtros por carrera y estado de cartera. El estado se calcula al
// vuelo (D6), así que su filtro y la búsqueda sin tildes se aplican aquí y no en SQL. Para el tamaño de la
// Fundación (cientos de estudiantes) es una sola consulta y no hace falta paginar.
estudiantes.get("/", async (c) => {
  const { q, carrera, estado } = c.req.query();
  const carreraId = carrera === undefined ? null : Number(carrera);
  if (carreraId !== null && !(Number.isSafeInteger(carreraId) && carreraId > 0)) {
    return responderError(c, 400, "SOLICITUD_INVALIDA", "El filtro de carrera no es válido");
  }
  if (estado !== undefined && !ESTADOS_MORA.includes(estado as EstadoMora)) {
    return responderError(c, 400, "SOLICITUD_INVALIDA", "El estado de cartera debe ser al_dia, en_riesgo, bloqueado o con_excepcion");
  }

  const orden = "ORDER BY u.apellidos, u.nombres";
  const consulta =
    carreraId === null
      ? c.env.DB.prepare(`${SELECT_ESTUDIANTE} ${orden}`)
      : c.env.DB.prepare(`${SELECT_ESTUDIANTE} WHERE e.carrera_id = ? ${orden}`).bind(carreraId);
  const [{ results }, estadoDe] = await Promise.all([consulta.all<FilaEstudiante>(), estadosDeCartera(c.env.DB, hoyEnBogota())]);

  // Cada palabra buscada debe aparecer en el nombre completo o en el documento
  const palabras = normalizar(q ?? "").split(/\s+/).filter(Boolean);
  const lista = results
    .filter((f) => {
      const texto = normalizar(`${f.nombres} ${f.apellidos} ${f.documento}`);
      return palabras.every((p) => texto.includes(p));
    })
    .map((f) => aEstudiante(f, estadoDe(f.id)))
    .filter((e) => estado === undefined || e.estadoCartera === estado);
  return c.json(lista);
});

// D17: la contraseña temporal sale solo en esta respuesta (sin caché) y la base guarda su hash.
// D15: el usuario, su fila de estudiante y sus inscripciones van en un solo batch: o todo o nada.
estudiantes.post("/", validarJson(esquemaCrear), async (c) => {
  const datos = c.req.valid("json");
  const errorCarrera = await errorDeCarrera(c, datos.carreraId, datos.semestre, { exigirActiva: true });
  if (errorCarrera) return errorCarrera;

  const contrasenaTemporal = generarContrasenaTemporal();
  const hash = await hashContrasena(contrasenaTemporal);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO usuarios (rol, tipo_documento, documento, nombres, apellidos, correo, celular, password_hash, debe_cambiar_password)
         VALUES ('estudiante', ?, ?, ?, ?, ?, ?, ?, 1)`,
      ).bind(datos.tipoDocumento, datos.documento, datos.nombres, datos.apellidos, datos.correo, datos.celular ?? null, hash),
      // El documento es único: identifica al usuario recién creado dentro del mismo batch
      c.env.DB.prepare(
        `INSERT INTO estudiantes (usuario_id, carrera_id, semestre_actual, cohorte, fecha_ingreso)
         SELECT id, ?, ?, ?, ? FROM usuarios WHERE documento = ?`,
      ).bind(datos.carreraId, datos.semestre, datos.cohorte, datos.fechaIngreso, datos.documento),
      inscribirEstudiante(c.env.DB, { documento: datos.documento }),
    ]);
  } catch (error) {
    if (esUnicoRepetido(error, "usuarios.documento")) return documentoRepetido(c, datos.documento);
    throw error;
  }

  c.header("Cache-Control", "no-store");
  return c.json({ estudiante: await estudianteConEstado(c.env.DB, { documento: datos.documento }), contrasenaTemporal }, 201);
});

estudiantes.patch("/:id", validarJson(esquemaEditar), async (c) => {
  const id = idDeRuta(c);
  const actual = id
    ? await c.env.DB.prepare(`${SELECT_ESTUDIANTE} WHERE u.id = ?`).bind(id).first<FilaEstudiante>()
    : null;
  if (!id || !actual) return responderError(c, 404, "ESTUDIANTE_NO_ENCONTRADO", "El estudiante no existe");
  const datos = c.req.valid("json");

  // Cambio de carrera o de semestre: el semestre debe caber en la carrera, y una carrera nueva debe estar activa
  const cambiaUbicacion =
    (datos.carreraId !== undefined && datos.carreraId !== actual.carrera_id) ||
    (datos.semestreActual !== undefined && datos.semestreActual !== actual.semestre_actual);
  if (cambiaUbicacion) {
    const errorCarrera = await errorDeCarrera(c, datos.carreraId ?? actual.carrera_id, datos.semestreActual ?? actual.semestre_actual, {
      exigirActiva: datos.carreraId !== undefined && datos.carreraId !== actual.carrera_id,
    });
    if (errorCarrera) return errorCarrera;
  }

  const sentencias = [
    actualizar(c.env.DB, "usuarios", id, {
      tipo_documento: datos.tipoDocumento,
      documento: datos.documento,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      correo: datos.correo,
      celular: datos.celular,
    }),
    actualizar(c.env.DB, "estudiantes", id, {
      carrera_id: datos.carreraId,
      semestre_actual: datos.semestreActual,
      cohorte: datos.cohorte,
      fecha_ingreso: datos.fechaIngreso,
    }),
    // D15: se agregan las inscripciones de la nueva ubicación; las anteriores se conservan (historial)
    cambiaUbicacion ? inscribirEstudiante(c.env.DB, { id }) : null,
  ].filter((s): s is D1PreparedStatement => s !== null);

  try {
    await c.env.DB.batch(sentencias);
  } catch (error) {
    if (datos.documento && esUnicoRepetido(error, "usuarios.documento")) return documentoRepetido(c, datos.documento);
    throw error;
  }
  return c.json(await estudianteConEstado(c.env.DB, { id }));
});
