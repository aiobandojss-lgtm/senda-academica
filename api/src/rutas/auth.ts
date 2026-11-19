import { Hono } from "hono";
import { z } from "zod";
import { estaBloqueado } from "../dominio/mora";
import { responderError, validarJson } from "../errores";
import { HASH_SIMULADO, hashContrasena, validarContrasenaNueva, verificarContrasena } from "../seguridad/contrasenas";
import { limpiarIntentos, registrarIntento } from "../seguridad/intentos";
import { accesoSuspendido, type FilaUsuarioSesion, noAutenticado, usuarioSesion } from "../seguridad/permisos";
import { abrirSesion, cerrarSesion, leerSesion } from "../seguridad/sesion";
import type { AppEnv, UsuarioSesion } from "../tipos";

// Ingreso, cierre de sesión y perfil de la sesión actual (spec `autenticacion`)
export const auth = new Hono<AppEnv>();

type FilaIngreso = FilaUsuarioSesion & { password_hash: string; sesion_version: number; activo: number };

// Lo único que el frontend necesita para decidir qué pantalla mostrar (D18: proyección explícita, así un
// campo nuevo de la sesión no se filtra solo). Las dos banderas son las compuertas de primer ingreso (D16).
const perfil = (u: UsuarioSesion) => ({
  id: u.id,
  rol: u.rol,
  nombres: u.nombres,
  apellidos: u.apellidos,
  debeCambiarPassword: u.debeCambiarPassword,
  debeAceptarAviso: u.debeAceptarAviso,
});

const esquemaIngreso = z.object({
  // trim: el autocompletado del celular suele agregar un espacio al final
  documento: z.string().trim().min(1).max(20),
  contrasena: z.string().min(1).max(128),
});

auth.post("/ingresar", validarJson(esquemaIngreso, "Escribe tu documento y tu contraseña"), async (c) => {
  const { documento, contrasena } = c.req.valid("json");

  // D14: el intento se registra antes de verificar; del sexto en adelante se rechaza sin calcular el hash.
  // El mensaje es el mismo exista o no el documento.
  if (!(await registrarIntento(c.env.DB, documento))) {
    return responderError(c, 429, "DEMASIADOS_INTENTOS", "Demasiados intentos. Intenta de nuevo en 15 minutos");
  }

  const usuario = await c.env.DB.prepare(
    `SELECT id, rol, nombres, apellidos, password_hash, debe_cambiar_password, sesion_version,
            aviso_version_aceptada, activo
       FROM usuarios
      WHERE documento = ?`,
  )
    .bind(documento)
    .first<FilaIngreso>();

  // Siempre se calcula un hash, exista o no el documento: el tiempo de respuesta tampoco debe revelarlo
  const contrasenaValida = await verificarContrasena(contrasena, usuario?.password_hash ?? HASH_SIMULADO);
  if (!usuario || !contrasenaValida) {
    // La fila del intento queda registrada como fallo
    return responderError(c, 401, "CREDENCIALES_INVALIDAS", "Documento o contraseña incorrectos");
  }

  // Contraseña correcta, aunque la cuenta esté inactiva: el conteo de fallos vuelve a cero
  await limpiarIntentos(c.env.DB, documento);

  // Solo con la contraseña correcta se dice que la cuenta está inactiva; antes revelaría que el documento existe
  if (usuario.activo !== 1) {
    return responderError(c, 403, "CUENTA_INACTIVA", `Tu cuenta está inactiva. Comunícate con ${c.env.CONTACTO_FUNDACION}.`);
  }

  // Bloqueo por mora (spec "Estudiante bloqueado no puede ingresar"): después de la contraseña, para no revelar
  // a quien no la sabe que la cuenta existe. Sin sesión abierta. A docentes y administradores no se les evalúa.
  if (usuario.rol === "estudiante" && (await estaBloqueado(c.env.DB, usuario.id))) return accesoSuspendido(c);

  await abrirSesion(c, { usuarioId: usuario.id, rol: usuario.rol, version: usuario.sesion_version });
  return c.json(perfil(usuarioSesion(usuario, c.env.AVISO_PRIVACIDAD_VERSION)));
});

// Siempre responde 204 y borra la cookie, haya o no sesión: no revela si un token sirve. Es POST para que un enlace o
// una imagen de otro sitio no puedan cerrar la sesión de nadie (con SameSite=Lax, otro sitio no envía la cookie en un POST).
// Con un token vigente, además lo revoca en el servidor (cambio cerrar-sesion-y-temas-de-cursos, design.md D1): sube la
// versión de sesión, así que esa cookie, aunque alguien la haya copiado, y las sesiones del usuario en otros equipos
// dejan de servir. La condición sobre la versión impide que un token ya revocado cierre las sesiones vigentes.
auth.post("/salir", async (c) => {
  const sesion = await leerSesion(c);
  if (sesion) {
    await c.env.DB.prepare("UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ? AND sesion_version = ?")
      .bind(sesion.usuarioId, sesion.version)
      .run();
  }
  cerrarSesion(c);
  return c.body(null, 204);
});

// La sesión ya la validó requiereSesion (index.ts), que deja pasar esta ruta aunque falten las
// compuertas de D16: el frontend la usa para saber qué pantalla mostrar
auth.get("/yo", (c) => c.json(perfil(c.var.usuario)));

const esquemaCambio = z.object({
  actual: z.string().min(1).max(128),
  nueva: z.string().min(1).max(128),
});

// Cambio de contraseña, obligatorio (primer ingreso o tras un restablecimiento) o voluntario. Siempre pide
// la actual (design.md D16). Permitida aunque falten las compuertas de D16 (index.ts).
auth.post("/contrasena", validarJson(esquemaCambio, "Escribe tu contraseña actual y la nueva"), async (c) => {
  const { actual, nueva } = c.req.valid("json");
  const { id } = c.var.usuario;

  const fila = await c.env.DB.prepare("SELECT documento, password_hash FROM usuarios WHERE id = ?")
    .bind(id)
    .first<{ documento: string; password_hash: string }>();
  if (!fila) return noAutenticado(c);

  // Primero las reglas, que no cuestan CPU; después la contraseña actual (PBKDF2)
  const incumplida = validarContrasenaNueva(nueva, { documento: fila.documento, actual });
  if (incumplida) return responderError(c, 400, incumplida.codigo, incumplida.mensaje);

  if (!(await verificarContrasena(actual, fila.password_hash))) {
    return responderError(c, 400, "CONTRASENA_ACTUAL_INCORRECTA", "La contraseña actual no es correcta");
  }

  // Subir sesion_version cierra las sesiones de los otros equipos (D4)
  const actualizado = await c.env.DB.prepare(
    `UPDATE usuarios
        SET password_hash = ?, debe_cambiar_password = 0, sesion_version = sesion_version + 1
      WHERE id = ?
  RETURNING sesion_version`,
  )
    .bind(await hashContrasena(nueva), id)
    .first<{ sesion_version: number }>();
  if (!actualizado) return noAutenticado(c);

  // Esta sesión sigue abierta con un token de la versión nueva. Sus 8 horas empiezan de nuevo:
  // quien acaba de demostrar su contraseña se autenticó otra vez
  await abrirSesion(c, { usuarioId: id, rol: c.var.usuario.rol, version: actualizado.sesion_version });
  return c.json(perfil({ ...c.var.usuario, debeCambiarPassword: false }));
});

// Aceptación del aviso de privacidad (Ley 1581, design.md D16): guarda la versión vigente y la fecha (D9).
// Permitida aunque falte cambiar la contraseña temporal. El texto del aviso vive en el frontend.
auth.post("/aviso", async (c) => {
  await c.env.DB.prepare(
    `UPDATE usuarios
        SET aviso_version_aceptada = ?, aviso_aceptado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?`,
  )
    .bind(c.env.AVISO_PRIVACIDAD_VERSION, c.var.usuario.id)
    .run();

  return c.json(perfil({ ...c.var.usuario, debeAceptarAviso: false }));
});
