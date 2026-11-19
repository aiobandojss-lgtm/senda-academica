import { env } from "cloudflare:workers";
import { decode, sign } from "hono/jwt";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { conCookie, crearUsuario, ingresar, JSON_HEADERS, pedir, sesionDe, tokenDe } from "./utilidades";

// Escenarios de la spec `autenticacion` (inicio, cierre y expiración de sesión) con usuarios propios
// de la prueba: el código no debe depender de los datos del seed.

const CONTRASENA = "Prueba2026*";
const OCHO_HORAS = 8 * 60 * 60;

const ACTIVO = { documento: "7000000001", nombres: "Ana María", apellidos: "Rentería Mosquera" };
const INACTIVO = { documento: "7000000002" };
const TEMPORAL = { documento: "7000000003" };
const AVISO_VIEJO = { documento: "7000000004" };
const INEXISTENTE = "7000000999";

let idActivo: number;

const ahora = () => Math.floor(Date.now() / 1000);

beforeAll(async () => {
  // Un solo hash para todos: cada uno cuesta 100.000 iteraciones
  const hash = await hashContrasena(CONTRASENA);
  const avisoVigente = env.AVISO_PRIVACIDAD_VERSION;

  // sesion_version = 3 para comprobar que el token copia la versión de la base y no un valor fijo
  idActivo = await crearUsuario({ ...ACTIVO, sesionVersion: 3, avisoVersion: avisoVigente }, hash);
  await crearUsuario({ ...INACTIVO, activo: 0, avisoVersion: avisoVigente }, hash);
  await crearUsuario({ ...TEMPORAL, debeCambiarPassword: 1 }, hash);
  await crearUsuario({ ...AVISO_VIEJO, avisoVersion: "2025-01" }, hash);
});

describe("POST /api/auth/ingresar", () => {
  it("credenciales correctas: responde el perfil y abre la sesión en una cookie HttpOnly de 8 horas", async () => {
    const respuesta = await ingresar(ACTIVO.documento, CONTRASENA);

    expect(respuesta.status).toBe(200);
    // Solo lo que la pantalla de inicio necesita: nunca el hash, el documento ni el correo (D18)
    expect(await respuesta.json()).toEqual({
      id: idActivo,
      rol: "estudiante",
      nombres: ACTIVO.nombres,
      apellidos: ACTIVO.apellidos,
      debeCambiarPassword: false,
      debeAceptarAviso: false,
    });

    const cookie = respuesta.headers.get("Set-Cookie");
    expect(cookie).toMatch(/^__Host-sesion=[^;]+/);
    for (const atributo of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", `Max-Age=${OCHO_HORAS}`]) {
      expect(cookie).toContain(atributo);
    }
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("el token lleva solo id, rol y versión de sesión de la base (D4), firmado con HS256 y vence en 8 horas", async () => {
    const { header, payload } = decode(tokenDe(await ingresar(ACTIVO.documento, CONTRASENA)));

    expect(header.alg).toBe("HS256");
    expect(payload).toMatchObject({ sub: String(idActivo), rol: "estudiante", ver: 3 });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(OCHO_HORAS);
    // El JWT se puede leer en base64: no lleva datos personales
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "rol", "sub", "ver"]);
  });

  it("contraseña incorrecta: 'Documento o contraseña incorrectos' y no inicia sesión", async () => {
    const respuesta = await ingresar(ACTIVO.documento, "Prueba2026+");

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ codigo: "CREDENCIALES_INVALIDAS", mensaje: "Documento o contraseña incorrectos" });
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
  });

  it("documento inexistente: exactamente la misma respuesta que la contraseña incorrecta", async () => {
    const incorrecta = await ingresar(ACTIVO.documento, "Prueba2026+");
    const inexistente = await ingresar(INEXISTENTE, CONTRASENA);

    expect(inexistente.status).toBe(incorrecta.status);
    expect(await inexistente.json()).toEqual(await incorrecta.json());
    expect(inexistente.headers.get("Set-Cookie")).toBeNull();
  });

  it("Usuario inactivo: con la contraseña correcta no inicia sesión y le indica que su cuenta está inactiva", async () => {
    const respuesta = await ingresar(INACTIVO.documento, CONTRASENA);

    expect(respuesta.status).toBe(403);
    const cuerpo = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(cuerpo.codigo).toBe("CUENTA_INACTIVA");
    expect(cuerpo.mensaje).toContain("inactiva");
    // A quién acudir sale de la configuración (D19), no del código
    expect(cuerpo.mensaje).toContain(env.CONTACTO_FUNDACION);
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
  });

  it("usuario inactivo con una contraseña incorrecta: mensaje genérico (no revela que la cuenta existe)", async () => {
    const respuesta = await ingresar(INACTIVO.documento, "Prueba2026+");

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
  });

  it("Nueva versión del aviso: informa las compuertas de primer ingreso (D16), contraseña temporal y aviso sin aceptar o de otra versión", async () => {
    expect(await (await ingresar(TEMPORAL.documento, CONTRASENA)).json()).toMatchObject({
      debeCambiarPassword: true,
      debeAceptarAviso: true,
    });
    expect(await (await ingresar(AVISO_VIEJO.documento, CONTRASENA)).json()).toMatchObject({
      debeCambiarPassword: false,
      debeAceptarAviso: true,
    });
  });

  it("acepta el documento con espacios alrededor (los agrega el autocompletado del celular)", async () => {
    expect((await ingresar(` ${ACTIVO.documento} `, CONTRASENA)).status).toBe(200);
  });

  it("solicitud incompleta, sin JSON o con JSON roto: 400 SOLICITUD_INVALIDA y sin cookie", async () => {
    const respuestas = [
      await pedir("/auth/ingresar", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ documento: ACTIVO.documento }) }),
      await pedir("/auth/ingresar", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ documento: "", contrasena: CONTRASENA }) }),
      await pedir("/auth/ingresar", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "documento=7000000001" }),
      await pedir("/auth/ingresar", { method: "POST", headers: JSON_HEADERS, body: '{"documento": ' }),
    ];

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(400);
      expect(await respuesta.json()).toMatchObject({ codigo: "SOLICITUD_INVALIDA" });
      expect(respuesta.headers.get("Set-Cookie")).toBeNull();
    }
  });
});

describe("GET /api/auth/yo", () => {
  it("con la cookie del ingreso devuelve el mismo perfil", async () => {
    const ingreso = await ingresar(ACTIVO.documento, CONTRASENA);
    const perfil = await ingreso.json();

    const respuesta = await pedir("/auth/yo", conCookie(tokenDe(ingreso)));

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual(perfil);
  });

  it("sin cookie responde 401 NO_AUTENTICADO", async () => {
    const respuesta = await pedir("/auth/yo");

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  it("con un token firmado con otra clave responde 401, aunque diga ser administrador", async () => {
    const falso = await sign(
      { sub: String(idActivo), rol: "admin", ver: 3, iat: ahora(), exp: ahora() + 3600 },
      "otra-clave-cualquiera-de-al-menos-32-caracteres",
      "HS256",
    );

    expect((await pedir("/auth/yo", conCookie(falso))).status).toBe(401);
  });

  it("Sesión vencida: con una sesión iniciada hace más de 8 horas responde 401 y pide ingresar de nuevo", async () => {
    const hace9Horas = ahora() - 9 * 60 * 60;
    const vencido = await sign(
      { sub: String(idActivo), rol: "estudiante", ver: 3, iat: hace9Horas, exp: hace9Horas + OCHO_HORAS },
      env.JWT_SECRET,
      "HS256",
    );

    const respuesta = await pedir("/auth/yo", conCookie(vencido));
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toEqual({ codigo: "NO_AUTENTICADO", mensaje: "Tu sesión terminó. Ingresa de nuevo" });
  });

  it("con algo que no es un JWT en la cookie responde 401", async () => {
    expect((await pedir("/auth/yo", conCookie("no-es-un-jwt"))).status).toBe(401);
  });
});

describe("configuración insegura", () => {
  it("sin un JWT_SECRET válido el ingreso responde 500 sin cookie, y el log no incluye documento ni contraseña", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    // app.request permite cambiar la configuración solo para esta petición
    const respuesta = await app.request(
      "/api/auth/ingresar",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ documento: ACTIVO.documento, contrasena: CONTRASENA }) },
      { ...env, JWT_SECRET: "corta" },
    );

    expect(respuesta.status).toBe(500);
    expect(await respuesta.json()).toMatchObject({ codigo: "ERROR_INTERNO" });
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();

    expect(consola).toHaveBeenCalled();
    const registrado = JSON.stringify(consola.mock.calls);
    expect(registrado).not.toContain(ACTIVO.documento);
    expect(registrado).not.toContain(CONTRASENA);
    consola.mockRestore();
  });
});

describe("POST /api/auth/salir", () => {
  // Usuarios propios: cerrar sesión sube su versión de sesión (cambio cerrar-sesion-y-temas-de-cursos, design.md D1)
  const SALE = { documento: "7000000010" };
  const DOS_EQUIPOS = { documento: "7000000011" };
  const REVOCADO = { documento: "7000000012" };
  const idsSalir: Record<string, number> = {};

  beforeAll(async () => {
    const hash = await hashContrasena(CONTRASENA);
    for (const u of [SALE, DOS_EQUIPOS, REVOCADO]) {
      idsSalir[u.documento] = await crearUsuario({ ...u, avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
    }
  });

  const salir = (token?: string) => pedir("/auth/salir", token ? conCookie(token, { method: "POST" }) : { method: "POST" });
  const yo = (token: string) => pedir("/auth/yo", conCookie(token));
  // La sesión del mismo usuario en otro equipo: mismo usuario y versión, otra hora de ingreso. Dos ingresos en el
  // mismo segundo dan el mismo JWT, y la prueba no distinguiría "revoca este token" de "revoca todas sus sesiones"
  const enOtroEquipo = async (token: string) => {
    const { payload } = decode(token);
    const iat = Number(payload.iat) - 60;
    return sign({ ...payload, iat, exp: iat + OCHO_HORAS }, env.JWT_SECRET, "HS256");
  };

  it("Cerrar sesión: borra la cookie y el token deja de servir en el servidor, aunque alguien lo hubiera copiado antes", async () => {
    // Lo que tendría quien copió la cookie antes de que el usuario saliera
    const copia = await sesionDe(SALE.documento, CONTRASENA);
    expect((await yo(copia)).status).toBe(200);

    const respuesta = await salir(copia);

    expect(respuesta.status).toBe(204);
    const cookie = respuesta.headers.get("Set-Cookie");
    expect(cookie).toMatch(/^__Host-sesion=;/);
    for (const atributo of ["Max-Age=0", "Path=/", "Secure", "HttpOnly"]) {
      expect(cookie).toContain(atributo);
    }
    const despues = await yo(copia);
    expect(despues.status).toBe(401);
    expect(await despues.json()).toMatchObject({ codigo: "NO_AUTENTICADO" });
  });

  it("sin sesión también responde 204 y borra la cookie, sin revelar nada", async () => {
    const respuesta = await salir();

    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get("Set-Cookie")).toMatch(/^__Host-sesion=;/);
  });

  it("Cierre de sesión desde otro equipo: con dos sesiones abiertas, cerrar una deja a la otra sin validez", async () => {
    const computador = await sesionDe(DOS_EQUIPOS.documento, CONTRASENA);
    const celular = await enOtroEquipo(computador);
    expect(celular).not.toBe(computador);
    expect((await yo(celular)).status).toBe(200);

    expect((await salir(computador)).status).toBe(204);

    expect((await yo(celular)).status).toBe(401);
  });

  it("Cierre con una sesión que ya no es válida: responde 204 y la sesión vigente del usuario sigue funcionando", async () => {
    const vieja = await sesionDe(REVOCADO.documento, CONTRASENA);
    // Como un restablecimiento de contraseña: la sesión vieja queda revocada y el usuario vuelve a ingresar
    await env.DB.prepare("UPDATE usuarios SET sesion_version = sesion_version + 1 WHERE id = ?").bind(idsSalir[REVOCADO.documento]).run();
    const vigente = await sesionDe(REVOCADO.documento, CONTRASENA);
    expect((await yo(vieja)).status).toBe(401);

    expect((await salir(vieja)).status).toBe(204);

    expect((await yo(vigente)).status).toBe(200);
  });
});
