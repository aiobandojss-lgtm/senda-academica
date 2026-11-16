import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { ROLES, type AppEnv, type Rol } from "../tipos";

// Sesión (design.md D4): JWT HS256 en una cookie HttpOnly, 8 horas desde el ingreso.

// Con prefix "host" el nombre real es "__Host-sesion": el navegador solo la acepta con Secure, Path=/
// y sin Domain, así ningún subdominio puede sobrescribirla
const COOKIE = "sesion";
const DURACION_SEGUNDOS = 8 * 60 * 60;
const ALGORITMO = "HS256";
const LONGITUD_MINIMA_SECRETO = 32;

// HttpOnly: JavaScript no puede leerla (protege contra robo por XSS).
// SameSite=Lax: el navegador no la envía en peticiones POST desde otros sitios (protege contra CSRF).
const OPCIONES_COOKIE = { prefix: "host", path: "/", secure: true, httpOnly: true, sameSite: "Lax" } as const;

export type DatosSesion = { usuarioId: number; rol: Rol; version: number };

// El token solo lleva identificadores, nunca datos personales: un JWT se lee con un simple base64
const esquemaToken = z.object({
  sub: z.string().regex(/^\d+$/),
  rol: z.enum(ROLES),
  ver: z.number().int().min(0),
});

// Un secreto ausente o corto es un error de configuración: se falla en lugar de firmar con una clave débil
function secreto(env: Env): string {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(`JWT_SECRET no está configurado o tiene menos de ${LONGITUD_MINIMA_SECRETO} caracteres`);
  }
  return env.JWT_SECRET;
}

export async function abrirSesion(c: Context<AppEnv>, datos: DatosSesion): Promise<void> {
  const ahora = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: String(datos.usuarioId), rol: datos.rol, ver: datos.version, iat: ahora, exp: ahora + DURACION_SEGUNDOS },
    secreto(c.env),
    ALGORITMO,
  );
  setCookie(c, COOKIE, token, { ...OPCIONES_COOKIE, maxAge: DURACION_SEGUNDOS });
}

// Devuelve los datos del token si la firma y el vencimiento son válidos; si no, null.
// Que el usuario siga activo y que la versión coincida con la base lo verifica requiereSesion (permisos.ts).
export async function leerSesion(c: Context<AppEnv>): Promise<DatosSesion | null> {
  const token = getCookie(c, COOKIE, "host");
  if (!token) return null;

  // Fuera del try: un secreto mal configurado debe responder 500, no "no autenticado"
  const clave = secreto(c.env);
  try {
    // El algoritmo se exige explícito: un token que diga "alg: none" u otro algoritmo se rechaza
    const datos = esquemaToken.safeParse(await verify(token, clave, ALGORITMO));
    if (!datos.success) return null;
    return { usuarioId: Number(datos.data.sub), rol: datos.data.rol, version: datos.data.ver };
  } catch {
    // Firma inválida, token vencido o mal formado: para el usuario es lo mismo, no hay sesión
    return null;
  }
}

export function cerrarSesion(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, OPCIONES_COOKIE);
}
