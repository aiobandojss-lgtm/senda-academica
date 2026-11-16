import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { responderError } from "../errores";
import type { AppEnv, Rol, UsuarioSesion } from "../tipos";
import { leerSesion } from "./sesion";

// Permisos en el servidor (spec `autenticacion`, design.md D4 y D16). Hono ejecuta estos middlewares
// antes de la ruta y cortan la petición si algo falla, como un trigger BEFORE que aborta la operación.

export type ReglasSesion = {
  // Rutas que no exigen sesión, escritas como "MÉTODO /api/ruta"
  publicas: readonly string[];
  // Rutas permitidas aunque falte cambiar la contraseña temporal o aceptar el aviso de privacidad (D16)
  sinCompuertas: readonly string[];
};

// Columnas de usuarios con las que se arma la sesión: nunca documento, correo ni hash (D18)
export type FilaUsuarioSesion = {
  id: number;
  rol: Rol;
  nombres: string;
  apellidos: string;
  debe_cambiar_password: number;
  aviso_version_aceptada: string | null;
};

type FilaUsuario = FilaUsuarioSesion & { activo: number; sesion_version: number };

export const usuarioSesion = (fila: FilaUsuarioSesion, avisoVigente: string): UsuarioSesion => ({
  id: fila.id,
  rol: fila.rol,
  nombres: fila.nombres,
  apellidos: fila.apellidos,
  debeCambiarPassword: fila.debe_cambiar_password === 1,
  // Una versión distinta de la vigente cuenta como no aceptada: publicar un aviso nuevo es cambiar la variable
  debeAceptarAviso: fila.aviso_version_aceptada !== avisoVigente,
});

export const noAutenticado = (c: Context) => responderError(c, 401, "NO_AUTENTICADO", "Tu sesión terminó. Ingresa de nuevo");

// También para reglas sobre un recurso concreto, como el docente que pide un curso que no es suyo
export const accesoDenegado = (c: Context) => responderError(c, 403, "ACCESO_DENEGADO", "No tienes permiso para esta operación");

export const requiereSesion = ({ publicas, sinCompuertas }: ReglasSesion) =>
  createMiddleware<AppEnv>(async (c, next) => {
    // Se compara la ruta exacta. Una variante (por ejemplo, con "/" al final) no coincide con la lista
    // y se le exige sesión: un error en la lista cierra la ruta, nunca la abre
    const ruta = `${c.req.method} ${c.req.path}`;
    if (publicas.includes(ruta)) return next();

    const sesion = await leerSesion(c);
    if (!sesion) return noAutenticado(c);

    // D4: una lectura por llave primaria en cada petición, para que la revocación sea inmediata
    const fila = await c.env.DB.prepare(
      `SELECT id, rol, nombres, apellidos, debe_cambiar_password, aviso_version_aceptada, activo, sesion_version
         FROM usuarios
        WHERE id = ?`,
    )
      .bind(sesion.usuarioId)
      .first<FilaUsuario>();

    // Usuario inexistente, desactivado o con la sesión revocada: para él es lo mismo, la sesión terminó
    if (!fila || fila.activo !== 1 || fila.sesion_version !== sesion.version) return noAutenticado(c);

    // El rol sale de la base y no del token
    const usuario = usuarioSesion(fila, c.env.AVISO_PRIVACIDAD_VERSION);
    c.set("usuario", usuario);

    if (!sinCompuertas.includes(ruta)) {
      // Primero la contraseña, que protege la cuenta; el aviso se acepta en la pantalla siguiente
      if (usuario.debeCambiarPassword) {
        return responderError(c, 403, "DEBE_CAMBIAR_PASSWORD", "Debes cambiar tu contraseña antes de continuar");
      }
      if (usuario.debeAceptarAviso) {
        return responderError(c, 403, "DEBE_ACEPTAR_AVISO", "Debes aceptar el aviso de privacidad antes de continuar");
      }
    }

    await next();
  });

// Va después de requiereSesion, en la ruta o en el grupo de rutas: requiereRol("admin")
export const requiereRol = (...roles: Rol[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.var.usuario.rol)) return accesoDenegado(c);
    await next();
  });
