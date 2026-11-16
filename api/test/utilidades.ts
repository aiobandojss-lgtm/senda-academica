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

// Petición con sesión y cuerpo JSON, como la haría el frontend
export const llamar = (token: string, metodo: "GET" | "POST" | "PATCH", ruta: string, cuerpo?: unknown) =>
  pedir(
    ruta,
    conCookie(token, {
      method: metodo,
      headers: cuerpo === undefined ? {} : JSON_HEADERS,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    }),
  );

// Inserta una carrera directamente en la D1 de pruebas y devuelve su id
export async function crearCarrera(codigo: string, opciones: { duracion?: number; activa?: 0 | 1 } = {}): Promise<number> {
  const resultado = await env.DB.prepare(
    "INSERT INTO carreras (codigo, nombre, duracion_semestres, activa) VALUES (?, ?, ?, ?)",
  )
    .bind(codigo, `Carrera ${codigo}`, opciones.duracion ?? 4, opciones.activa ?? 1)
    .run();
  return resultado.meta.last_row_id;
}

// Inserta un estudiante (usuario y fila de estudiantes) sin inscribirlo en ningún curso, como si
// existiera antes de los cursos. La API de registro, con su inscripción automática, es la tarea 3.2.
export async function crearEstudiante(
  e: { documento: string; carreraId: number; semestre: number; activo?: 0 | 1 },
  passwordHash: string,
): Promise<number> {
  const id = await crearUsuario({ documento: e.documento, activo: e.activo, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, passwordHash);
  await env.DB.prepare(
    "INSERT INTO estudiantes (usuario_id, carrera_id, semestre_actual, cohorte, fecha_ingreso) VALUES (?, ?, ?, '2026-2', '2026-08-01')",
  )
    .bind(id, e.carreraId, e.semestre)
    .run();
  return id;
}

// Ids de los estudiantes inscritos en un curso, en orden
export async function inscritosEn(cursoId: number): Promise<number[]> {
  const { results } = await env.DB.prepare("SELECT estudiante_id FROM inscripciones WHERE curso_id = ? ORDER BY estudiante_id")
    .bind(cursoId)
    .all<{ estudiante_id: number }>();
  return results.map((r) => r.estudiante_id);
}
