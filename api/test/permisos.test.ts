import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { requiereRol, requiereSesion } from "../src/seguridad/permisos";
import type { AppEnv, Rol } from "../src/tipos";
import { conCookie, crearUsuario, ingresar, pedir, sesionDe } from "./utilidades";

// Tarea 2.4: middleware de sesión y permisos por rol (spec `autenticacion`, design.md D4 y D16).
// La API niega por defecto: toda ruta de /api exige sesión, salvo las que se declaran públicas.

const CONTRASENA = "Prueba2026*";

// Una ruta que nadie declaró pública y que todavía no existe: con "negar por defecto" exige sesión igual
const RUTA_NO_DECLARADA = "/cualquier-ruta";

const ESTUDIANTE = { documento: "7100000001" };
const ADMIN = { documento: "7100000002", rol: "admin" as const };
const DOCENTE = { documento: "7100000003", rol: "docente" as const };
const REVOCADO = { documento: "7100000004" };
const DESACTIVADO = { documento: "7100000005" };
const TEMPORAL = { documento: "7100000006" };
const AVISO_VIEJO = { documento: "7100000007" };
const SIN_NADA = { documento: "7100000008" };

const ids: Record<string, number> = {};

beforeAll(async () => {
  // Un solo hash para todos: cada uno cuesta 100.000 iteraciones
  const hash = await hashContrasena(CONTRASENA);
  const avisoVigente = env.AVISO_PRIVACIDAD_VERSION;

  for (const u of [ESTUDIANTE, ADMIN, DOCENTE, REVOCADO, DESACTIVADO]) {
    ids[u.documento] = await crearUsuario({ ...u, avisoVersion: avisoVigente }, hash);
  }
  await crearUsuario({ ...TEMPORAL, debeCambiarPassword: 1, avisoVersion: avisoVigente }, hash);
  await crearUsuario({ ...AVISO_VIEJO, avisoVersion: "2025-01" }, hash);
  // Como la cuenta de primer ingreso del seed: contraseña temporal y aviso nunca aceptado
  await crearUsuario({ ...SIN_NADA, debeCambiarPassword: 1 }, hash);
});

// Firma un token válido sin pasar por el ingreso: sirve para armar casos que el ingreso no produce
async function tokenFirmado(usuarioId: number, rol: Rol, version = 0): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return sign({ sub: String(usuarioId), rol, ver: version, iat: ahora, exp: ahora + 3600 }, env.JWT_SECRET, "HS256");
}

describe("negar por defecto", () => {
  it("sin sesión, una ruta que nadie declaró pública responde 401 NO_AUTENTICADO aunque todavía no exista", async () => {
    for (const method of ["GET", "POST"]) {
      const respuesta = await pedir(RUTA_NO_DECLARADA, { method });

      expect(respuesta.status).toBe(401);
      expect(await respuesta.json()).toEqual({ codigo: "NO_AUTENTICADO", mensaje: "Tu sesión terminó. Ingresa de nuevo" });
    }
  });

  it("las rutas públicas responden sin sesión", async () => {
    expect((await pedir("/salud")).status).toBe(200);
    expect((await pedir("/auth/salir", { method: "POST" })).status).toBe(204);
    // Llega a la ruta de ingreso: responde por las credenciales, no por la falta de sesión
    expect(await (await ingresar("7100000999", CONTRASENA)).json()).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
  });

  it("con una sesión válida y sin compuertas pendientes, la petición sigue su camino (404 si la ruta no existe)", async () => {
    const token = await sesionDe(ESTUDIANTE.documento, CONTRASENA);

    expect((await pedir(RUTA_NO_DECLARADA, conCookie(token))).status).toBe(404);
  });
});

describe("sesiones revocadas (D4)", () => {
  it("un token con una versión de sesión vieja responde 401", async () => {
    const token = await sesionDe(REVOCADO.documento, CONTRASENA);
    // Lo que harán el restablecimiento de contraseña y el cambio desde otro equipo (tarea 2.5)
    await env.DB.prepare("UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ?")
      .bind(ids[REVOCADO.documento])
      .run();

    const respuesta = await pedir("/auth/yo", conCookie(token));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  it("un usuario desactivado con la sesión abierta recibe 401 en su siguiente petición", async () => {
    const token = await sesionDe(DESACTIVADO.documento, CONTRASENA);
    await env.DB.prepare("UPDATE usuarios SET activo = 0 WHERE id = ?").bind(ids[DESACTIVADO.documento]).run();

    const respuesta = await pedir("/auth/yo", conCookie(token));

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  it("un token bien firmado de un usuario que no existe responde 401", async () => {
    const token = await tokenFirmado(999_999, "admin");

    expect((await pedir("/auth/yo", conCookie(token))).status).toBe(401);
  });
});

describe("compuertas de primer ingreso (D16)", () => {
  it("con contraseña temporal solo permite las rutas de D16; cualquier otra responde 403 DEBE_CAMBIAR_PASSWORD", async () => {
    const token = await sesionDe(TEMPORAL.documento, CONTRASENA);

    // Permitidas: consultar el perfil (el frontend decide qué pantalla mostrar) y cerrar sesión
    expect((await pedir("/auth/yo", conCookie(token))).status).toBe(200);
    expect((await pedir("/auth/salir", conCookie(token, { method: "POST" }))).status).toBe(204);

    const respuesta = await pedir(RUTA_NO_DECLARADA, conCookie(token));
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({
      codigo: "DEBE_CAMBIAR_PASSWORD",
      mensaje: "Debes cambiar tu contraseña antes de continuar",
    });
  });

  it("sin aceptar la versión vigente del aviso de privacidad responde 403 DEBE_ACEPTAR_AVISO", async () => {
    const token = await sesionDe(AVISO_VIEJO.documento, CONTRASENA);

    expect((await pedir("/auth/yo", conCookie(token))).status).toBe(200);

    const respuesta = await pedir(RUTA_NO_DECLARADA, conCookie(token));
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({
      codigo: "DEBE_ACEPTAR_AVISO",
      mensaje: "Debes aceptar el aviso de privacidad antes de continuar",
    });
  });

  it("si faltan las dos, primero pide cambiar la contraseña", async () => {
    const token = await sesionDe(SIN_NADA.documento, CONTRASENA);

    expect(await (await pedir(RUTA_NO_DECLARADA, conCookie(token))).json()).toMatchObject({
      codigo: "DEBE_CAMBIAR_PASSWORD",
    });
  });
});

describe("permisos por rol", () => {
  // Las rutas de administrador y docente llegan en los grupos 3 a 5; aquí se prueba el middleware
  // en una aplicación mínima con la misma D1 y la misma configuración
  const app = new Hono<AppEnv>()
    .use("*", requiereSesion({ publicas: [], sinCompuertas: [] }))
    .get("/solo-admin", requiereRol("admin"), (c) => c.json({ ok: true }))
    .get("/admin-o-docente", requiereRol("admin", "docente"), (c) => c.json({ ok: true }));

  const pedirComo = (ruta: string, token: string) => app.request(ruta, conCookie(token), env);

  it("un estudiante no accede a una ruta de administrador: 403 ACCESO_DENEGADO", async () => {
    const token = await tokenFirmado(ids[ESTUDIANTE.documento], "estudiante");

    const respuesta = await pedirComo("/solo-admin", token);

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ codigo: "ACCESO_DENEGADO", mensaje: "No tienes permiso para esta operación" });
  });

  it("el administrador sí accede a la ruta de administrador", async () => {
    const token = await tokenFirmado(ids[ADMIN.documento], "admin");

    expect((await pedirComo("/solo-admin", token)).status).toBe(200);
  });

  it("una ruta para varios roles admite a cada uno de ellos y a nadie más", async () => {
    expect((await pedirComo("/admin-o-docente", await tokenFirmado(ids[ADMIN.documento], "admin"))).status).toBe(200);
    expect((await pedirComo("/admin-o-docente", await tokenFirmado(ids[DOCENTE.documento], "docente"))).status).toBe(200);
    expect((await pedirComo("/admin-o-docente", await tokenFirmado(ids[ESTUDIANTE.documento], "estudiante"))).status).toBe(403);
  });

  it("el rol sale de la base y no del token: un estudiante con un token que dice 'admin' recibe 403", async () => {
    const token = await tokenFirmado(ids[ESTUDIANTE.documento], "admin");

    expect((await pedirComo("/solo-admin", token)).status).toBe(403);
  });
});
