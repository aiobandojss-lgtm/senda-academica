import { Hono } from "hono";
import { responderError } from "../errores";
import { generarContrasenaTemporal, hashContrasena } from "../seguridad/contrasenas";
import { limpiarIntentos } from "../seguridad/intentos";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";

// Operaciones del administrador sobre cualquier usuario (spec `autenticacion`)
export const usuarios = new Hono<AppEnv>();

// Restablecimiento de contraseña (design.md D4, D14 y D17): la temporal se devuelve solo en esta respuesta
// y la base guarda únicamente su hash
usuarios.post("/:id/restablecer-contrasena", requiereRol("admin"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id < 1) return responderError(c, 404, "USUARIO_NO_ENCONTRADO", "El usuario no existe");

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
  if (!usuario) return responderError(c, 404, "USUARIO_NO_ENCONTRADO", "El usuario no existe");

  // D14: si estaba bloqueado por intentos fallidos, puede ingresar de inmediato con la temporal
  await limpiarIntentos(c.env.DB, usuario.documento);

  // Ni el navegador ni un proxy deben guardar una respuesta que trae una contraseña
  c.header("Cache-Control", "no-store");
  return c.json({ contrasenaTemporal: temporal });
});
