import { Hono } from "hono";
import { z } from "zod";
import { responderError, validarJson } from "../errores";
import { HASH_SIMULADO, verificarContrasena } from "../seguridad/contrasenas";
import { limpiarIntentos, registrarIntento } from "../seguridad/intentos";
import { abrirSesion, cerrarSesion, leerSesion } from "../seguridad/sesion";
import type { AppEnv, Rol } from "../tipos";

// Ingreso, cierre de sesión y perfil de la sesión actual (spec `autenticacion`)
export const auth = new Hono<AppEnv>();

type FilaPerfil = {
  id: number;
  rol: Rol;
  nombres: string;
  apellidos: string;
  debe_cambiar_password: number;
  aviso_version_aceptada: string | null;
};

type FilaIngreso = FilaPerfil & { password_hash: string; sesion_version: number; activo: number };

// Lo único que el frontend necesita para decidir qué pantalla mostrar (D18: nada de documento, correo ni hash).
// Las dos banderas son las compuertas de primer ingreso (D16).
const perfil = (u: FilaPerfil, avisoVigente: string) => ({
  id: u.id,
  rol: u.rol,
  nombres: u.nombres,
  apellidos: u.apellidos,
  debeCambiarPassword: u.debe_cambiar_password === 1,
  debeAceptarAviso: u.aviso_version_aceptada !== avisoVigente,
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

  await abrirSesion(c, { usuarioId: usuario.id, rol: usuario.rol, version: usuario.sesion_version });
  return c.json(perfil(usuario, c.env.AVISO_PRIVACIDAD_VERSION));
});

// Siempre responde 204 y borra la cookie, haya o no sesión. Es POST para que un enlace o una imagen
// de otro sitio no puedan cerrar la sesión de nadie.
auth.post("/salir", (c) => {
  cerrarSesion(c);
  return c.body(null, 204);
});

auth.get("/yo", async (c) => {
  const sesion = await leerSesion(c);
  if (!sesion) return responderError(c, 401, "NO_AUTENTICADO", "Tu sesión terminó. Ingresa de nuevo");

  const usuario = await c.env.DB.prepare(
    `SELECT id, rol, nombres, apellidos, debe_cambiar_password, aviso_version_aceptada
       FROM usuarios
      WHERE id = ?`,
  )
    .bind(sesion.usuarioId)
    .first<FilaPerfil>();
  if (!usuario) return responderError(c, 401, "NO_AUTENTICADO", "Tu sesión terminó. Ingresa de nuevo");

  return c.json(perfil(usuario, c.env.AVISO_PRIVACIDAD_VERSION));
});
