import { Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
import { esUnicoRepetido, idDeRuta, responderError, validarJson } from "../errores";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { conCambios, MENSAJE_SIN_CAMBIOS, texto, textoOpcional } from "../validacion";

// Catálogo de carreras (spec `carreras-estudiantes`). Solo el administrador. No hay borrado: una
// carrera se desactiva y deja de aceptar cursos y estudiantes nuevos, pero conserva su historia.
export const carreras = new Hono<AppEnv>();
carreras.use("*", requiereRol("admin"));

// En mayúsculas, como los del seed (TL-PSW): "tl-psw" y "TL-PSW" no pueden ser dos carreras
const codigo = z
  .string({ error: "Escribe el código de la carrera" })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,20}$/, "El código debe tener de 2 a 20 letras, números o guiones, por ejemplo TL-PSW");
const nombre = texto("Escribe el nombre de la carrera", 120, "El nombre");
const descripcion = textoOpcional(500, "La descripción");
const duracionSemestres = z
  .number({ error: "Escribe la duración en semestres" })
  .int("La duración debe ser un número entero de semestres")
  .min(1, "La duración debe ser de 1 a 12 semestres")
  .max(12, "La duración debe ser de 1 a 12 semestres");

const esquemaCrear = z.object({ codigo, nombre, descripcion: descripcion.optional(), duracionSemestres });
const esquemaEditar = z
  .object({
    codigo: codigo.optional(),
    nombre: nombre.optional(),
    descripcion: descripcion.optional(),
    duracionSemestres: duracionSemestres.optional(),
    activa: z.boolean({ error: "El estado de la carrera debe ser verdadero o falso" }).optional(),
  })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);

type FilaCarrera = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  duracion_semestres: number;
  activa: number;
  estudiantes_activos: number;
  cursos_activos: number;
};

const SELECT_CARRERA = `
  SELECT c.id, c.codigo, c.nombre, c.descripcion, c.duracion_semestres, c.activa,
    (SELECT COUNT(*) FROM estudiantes e JOIN usuarios u ON u.id = e.usuario_id
      WHERE e.carrera_id = c.id AND u.activo = 1) AS estudiantes_activos,
    (SELECT COUNT(*) FROM cursos k WHERE k.carrera_id = c.id AND k.activo = 1) AS cursos_activos
  FROM carreras c`;

// Proyección explícita hacia el cliente (D18)
const aCarrera = (f: FilaCarrera) => ({
  id: f.id,
  codigo: f.codigo,
  nombre: f.nombre,
  descripcion: f.descripcion,
  duracionSemestres: f.duracion_semestres,
  activa: f.activa === 1,
  estudiantesActivos: f.estudiantes_activos,
  cursosActivos: f.cursos_activos,
});

const buscarCarrera = (db: D1Database, id: number) =>
  db.prepare(`${SELECT_CARRERA} WHERE c.id = ?`).bind(id).first<FilaCarrera>();

carreras.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT_CARRERA} ORDER BY c.activa DESC, c.nombre`).all<FilaCarrera>();
  return c.json(results.map(aCarrera));
});

carreras.post("/", validarJson(esquemaCrear), async (c) => {
  const datos = c.req.valid("json");
  let id: number;
  try {
    const fila = await c.env.DB.prepare(
      "INSERT INTO carreras (codigo, nombre, descripcion, duracion_semestres) VALUES (?, ?, ?, ?) RETURNING id",
    )
      .bind(datos.codigo, datos.nombre, datos.descripcion ?? null, datos.duracionSemestres)
      .first<{ id: number }>();
    id = fila!.id;
  } catch (error) {
    if (esUnicoRepetido(error, "carreras.codigo")) return codigoRepetido(c, datos.codigo);
    throw error;
  }
  return c.json(aCarrera((await buscarCarrera(c.env.DB, id))!), 201);
});

carreras.patch("/:id", validarJson(esquemaEditar), async (c) => {
  const id = idDeRuta(c);
  const actual = id ? await buscarCarrera(c.env.DB, id) : null;
  if (!id || !actual) return responderError(c, 404, "CARRERA_NO_ENCONTRADA", "La carrera no existe");
  const datos = c.req.valid("json");

  // El semestre de cada curso debe caber en la carrera: también los inactivos, que se pueden reactivar
  if (datos.duracionSemestres !== undefined) {
    const { maximo } = (await c.env.DB.prepare("SELECT MAX(semestre) AS maximo FROM cursos WHERE carrera_id = ?")
      .bind(id)
      .first<{ maximo: number | null }>())!;
    if (maximo !== null && maximo > datos.duracionSemestres) {
      return responderError(
        c,
        409,
        "DURACION_MENOR_QUE_CURSOS",
        `La carrera tiene cursos hasta el semestre ${maximo}: la duración no puede ser menor`,
      );
    }
  }

  const sentencia = actualizar(c.env.DB, "carreras", id, {
    codigo: datos.codigo,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    duracion_semestres: datos.duracionSemestres,
    activa: datos.activa,
  });
  try {
    await sentencia?.run();
  } catch (error) {
    if (datos.codigo && esUnicoRepetido(error, "carreras.codigo")) return codigoRepetido(c, datos.codigo);
    throw error;
  }
  return c.json(aCarrera((await buscarCarrera(c.env.DB, id))!));
});

const codigoRepetido = (c: Parameters<typeof responderError>[0], codigoCarrera: string) =>
  responderError(c, 409, "CODIGO_CARRERA_REPETIDO", `Ya existe una carrera con el código ${codigoCarrera}`);
