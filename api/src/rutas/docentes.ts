import { type Context, Hono } from "hono";
import { z } from "zod";
import { actualizar } from "../datos";
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

// Registro de docentes (spec `carreras-estudiantes`). Solo el administrador. La desactivación y la
// reactivación son comunes a docentes y estudiantes: viven en rutas/usuarios.ts.
export const docentes = new Hono<AppEnv>();
docentes.use("*", requiereRol("admin"));

const campos = {
  tipoDocumento: campoTipoDocumento,
  documento: campoDocumento,
  nombres: campoNombres,
  apellidos: campoApellidos,
  correo: campoCorreo,
  celular: campoCelular,
};
const esquemaCrear = z.object({ ...campos, celular: campoCelular.optional() });
const esquemaEditar = z
  .object({
    tipoDocumento: campos.tipoDocumento.optional(),
    documento: campos.documento.optional(),
    nombres: campos.nombres.optional(),
    apellidos: campos.apellidos.optional(),
    correo: campos.correo.optional(),
    celular: campos.celular.optional(),
  })
  .refine(conCambios, MENSAJE_SIN_CAMBIOS);

type FilaDocente = {
  id: number;
  tipo_documento: string;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string | null;
  activo: number;
  cursos_activos: number;
};

const SELECT_DOCENTE = `
  SELECT u.id, u.tipo_documento, u.documento, u.nombres, u.apellidos, u.correo, u.celular, u.activo,
    (SELECT COUNT(*) FROM cursos k WHERE k.docente_id = u.id AND k.activo = 1) AS cursos_activos
  FROM usuarios u
  WHERE u.rol = 'docente'`;

// Proyección para el administrador (D18): nunca el hash ni los campos de sesión
const aDocente = (f: FilaDocente) => ({
  id: f.id,
  tipoDocumento: f.tipo_documento,
  documento: f.documento,
  nombres: f.nombres,
  apellidos: f.apellidos,
  correo: f.correo,
  celular: f.celular,
  activo: f.activo === 1,
  cursosActivos: f.cursos_activos,
});

const buscarDocente = (db: D1Database, id: number) => db.prepare(`${SELECT_DOCENTE} AND u.id = ?`).bind(id).first<FilaDocente>();

// El documento es único entre TODOS los usuarios: es el usuario para ingresar
export const documentoRepetido = (c: Context<AppEnv>, documento: string) =>
  responderError(c, 409, "DOCUMENTO_REPETIDO", `Ya existe un usuario con el documento ${documento}`);

docentes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT_DOCENTE} ORDER BY u.activo DESC, u.apellidos, u.nombres`).all<FilaDocente>();
  return c.json(results.map(aDocente));
});

// D17: la contraseña temporal sale solo en esta respuesta (sin caché) y la base guarda su hash.
// D16: el docente debe cambiarla y aceptar el aviso de privacidad en su primer ingreso.
docentes.post("/", validarJson(esquemaCrear), async (c) => {
  const datos = c.req.valid("json");
  const contrasenaTemporal = generarContrasenaTemporal();
  const hash = await hashContrasena(contrasenaTemporal);

  let id: number;
  try {
    const fila = await c.env.DB.prepare(
      `INSERT INTO usuarios (rol, tipo_documento, documento, nombres, apellidos, correo, celular, password_hash, debe_cambiar_password)
       VALUES ('docente', ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    )
      .bind(datos.tipoDocumento, datos.documento, datos.nombres, datos.apellidos, datos.correo, datos.celular ?? null, hash)
      .first<{ id: number }>();
    id = fila!.id;
  } catch (error) {
    if (esUnicoRepetido(error, "usuarios.documento")) return documentoRepetido(c, datos.documento);
    throw error;
  }

  c.header("Cache-Control", "no-store");
  return c.json({ docente: aDocente((await buscarDocente(c.env.DB, id))!), contrasenaTemporal }, 201);
});

docentes.patch("/:id", validarJson(esquemaEditar), async (c) => {
  const id = idDeRuta(c);
  if (!id || !(await buscarDocente(c.env.DB, id))) {
    return responderError(c, 404, "DOCENTE_NO_ENCONTRADO", "El docente no existe");
  }
  const datos = c.req.valid("json");

  try {
    await actualizar(c.env.DB, "usuarios", id, {
      tipo_documento: datos.tipoDocumento,
      documento: datos.documento,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      correo: datos.correo,
      celular: datos.celular,
    })?.run();
  } catch (error) {
    if (datos.documento && esUnicoRepetido(error, "usuarios.documento")) return documentoRepetido(c, datos.documento);
    throw error;
  }
  return c.json(aDocente((await buscarDocente(c.env.DB, id))!));
});
