import { Hono } from "hono";
import { inscribirEstudiante } from "../dominio/inscripciones";
import { idDeRuta, responderError } from "../errores";
import { generarContrasenaTemporal, hashContrasena } from "../seguridad/contrasenas";
import { limpiarIntentos } from "../seguridad/intentos";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";

// Operaciones del administrador sobre cualquier usuario (specs `autenticacion` y `carreras-estudiantes`)
export const usuarios = new Hono<AppEnv>();
usuarios.use("*", requiereRol("admin"));

const noEncontrado = (c: Parameters<typeof responderError>[0]) =>
  responderError(c, 404, "USUARIO_NO_ENCONTRADO", "El usuario no existe");

// Restablecimiento de contraseña (design.md D4, D14 y D17): la temporal se devuelve solo en esta respuesta
// y la base guarda únicamente su hash
usuarios.post("/:id/restablecer-contrasena", async (c) => {
  const id = idDeRuta(c);
  if (!id) return noEncontrado(c);

  const temporal = generarContrasenaTemporal();

  // Obliga a cambiarla en el siguiente ingreso y, al subir sesion_version, cierra sus sesiones abiertas
  const usuario = await c.env.DB.prepare(
    `UPDATE usuarios
        SET password_hash = ?, debe_cambiar_password = 1, sesion_version = sesion_version + 1
      WHERE id = ?
  RETURNING documento`,
  )
    .bind(await hashContrasena(temporal), id)
    .first<{ documento: string }>();
  if (!usuario) return noEncontrado(c);

  // D14: si estaba bloqueado por intentos fallidos, puede ingresar de inmediato con la temporal
  await limpiarIntentos(c.env.DB, usuario.documento);

  // Ni el navegador ni un proxy deben guardar una respuesta que trae una contraseña
  c.header("Cache-Control", "no-store");
  return c.json({ contrasenaTemporal: temporal });
});

// Desactivar y reactivar estudiantes y docentes (spec "Desactivar y reactivar usuarios"). Los
// administradores no pasan por aquí: así nadie deja la Fundación sin administrador por error.
// Nada se borra: su información, entregas, notas, pagos y cursos asignados se conservan.

// Al subir sesion_version se invalidan sus sesiones abiertas (D4); el ingreso ya rechaza a los inactivos
usuarios.post("/:id/desactivar", async (c) => {
  const id = idDeRuta(c);
  const fila = id
    ? await c.env.DB.prepare(
        `UPDATE usuarios SET activo = 0, sesion_version = sesion_version + 1
          WHERE id = ? AND rol IN ('docente', 'estudiante') RETURNING id`,
      )
        .bind(id)
        .first<{ id: number }>()
    : null;
  if (!fila) return noEncontrado(c);
  return c.json({ id: fila.id, activo: false });
});

// Vuelve a ingresar con su contraseña de siempre. Si es estudiante, queda inscrito en los cursos de su
// semestre que se crearon mientras estaba inactivo (D15); para un docente esa sentencia no inscribe nada.
usuarios.post("/:id/reactivar", async (c) => {
  const id = idDeRuta(c);
  if (!id) return noEncontrado(c);
  const [reactivado] = await c.env.DB.batch<{ id: number }>([
    c.env.DB.prepare("UPDATE usuarios SET activo = 1 WHERE id = ? AND rol IN ('docente', 'estudiante') RETURNING id").bind(id),
    inscribirEstudiante(c.env.DB, { id }),
  ]);
  if (reactivado.results.length === 0) return noEncontrado(c);
  return c.json({ id, activo: true });
});
