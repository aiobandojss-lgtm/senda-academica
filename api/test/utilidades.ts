import { env, exports } from "cloudflare:workers";
import type { Rol } from "../src/tipos";

// Ayudas compartidas por las pruebas de la API. No es un archivo de pruebas: Vitest solo corre *.test.ts.

export const JSON_HEADERS = { "Content-Type": "application/json" };

export type NuevoUsuario = {
  documento: string;
  // Por defecto, estudiante
  rol?: Rol;
  nombres?: string;
  apellidos?: string;
  activo?: 0 | 1;
  debeCambiarPassword?: 0 | 1;
  sesionVersion?: number;
  // undefined = nunca aceptó el aviso
  avisoVersion?: string;
};

// Inserta un usuario de prueba directamente en la D1 de pruebas y devuelve su id
export async function crearUsuario(u: NuevoUsuario, passwordHash: string): Promise<number> {
  const resultado = await env.DB.prepare(
    `INSERT INTO usuarios (rol, tipo_documento, documento, nombres, apellidos, correo, password_hash,
       debe_cambiar_password, sesion_version, aviso_version_aceptada, aviso_aceptado_en, activo)
     VALUES (?, 'CC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      u.rol ?? "estudiante",
      u.documento,
      u.nombres ?? "Prueba",
      u.apellidos ?? "Usuario",
      `${u.documento}@correo.test`,
      passwordHash,
      u.debeCambiarPassword ?? 0,
      u.sesionVersion ?? 0,
      u.avisoVersion ?? null,
      u.avisoVersion ? "2026-11-01T12:00:00Z" : null,
      u.activo ?? 1,
    )
    .run();
  return resultado.meta.last_row_id;
}

// exports.default es el Worker completo: la petición recorre el mismo camino que en producción
export const pedir = (ruta: string, init?: RequestInit) => exports.default.fetch(`https://senda.test/api${ruta}`, init);

export const ingresar = (documento: string, contrasena: string) =>
  pedir("/auth/ingresar", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ documento, contrasena }) });

// Opciones de fetch que envían la cookie de sesión, como lo haría el navegador
export const conCookie = (token: string, init: RequestInit & { headers?: Record<string, string> } = {}): RequestInit => ({
  ...init,
  headers: { ...init.headers, Cookie: `__Host-sesion=${token}` },
});

// Saca el JWT de la cookie que deja una respuesta de ingreso
export function tokenDe(respuesta: Response): string {
  const token = respuesta.headers.get("Set-Cookie")?.match(/__Host-sesion=([^;]+)/)?.[1];
  if (!token) throw new Error("La respuesta no trae la cookie de sesión");
  return token;
}

// Ingresa con documento y contraseña y devuelve el token de la sesión abierta
export async function sesionDe(documento: string, contrasena: string): Promise<string> {
  return tokenDe(await ingresar(documento, contrasena));
}
