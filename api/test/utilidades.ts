import { env, exports } from "cloudflare:workers";

// Ayudas compartidas por las pruebas de la API. No es un archivo de pruebas: Vitest solo corre *.test.ts.

export const JSON_HEADERS = { "Content-Type": "application/json" };

export type NuevoUsuario = {
  documento: string;
  nombres?: string;
  apellidos?: string;
  activo?: 0 | 1;
  debeCambiarPassword?: 0 | 1;
  sesionVersion?: number;
  // undefined = nunca aceptó el aviso
  avisoVersion?: string;
};

// Inserta un estudiante de prueba directamente en la D1 de pruebas y devuelve su id
export async function crearUsuario(u: NuevoUsuario, passwordHash: string): Promise<number> {
  const resultado = await env.DB.prepare(
    `INSERT INTO usuarios (rol, tipo_documento, documento, nombres, apellidos, correo, password_hash,
       debe_cambiar_password, sesion_version, aviso_version_aceptada, aviso_aceptado_en, activo)
     VALUES ('estudiante', 'CC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
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
