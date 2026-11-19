import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { ALFABETO_TEMPORAL, hashContrasena } from "../src/seguridad/contrasenas";
import { conCookie, crearUsuario, ingresar, JSON_HEADERS, pedir, sesionDe, tokenDe } from "./utilidades";

// Tarea 2.5: cambio de contraseña, aceptación del aviso de privacidad y restablecimiento por el
// administrador (spec `autenticacion`, design.md D4, D14, D16 y D17)

const CONTRASENA = "Prueba2026*";
const NUEVA = "Montaña2026";
// Una ruta que no es de D16: si responde 404 y no 403, las compuertas ya están abiertas
const RUTA_NO_DECLARADA = "/cualquier-ruta";

const TEMPORAL = { documento: "7200000001" };
const REGLAS = { documento: "7200000002" };
const VOLUNTARIO = { documento: "7200000003" };
const AVISO_VIEJO = { documento: "7200000004" };
const SIN_NADA = { documento: "7200000005" };
const OLVIDADIZO = { documento: "7200000006" };
const BLOQUEADO = { documento: "7200000007" };
const ADMIN = { documento: "7200000008", rol: "admin" as const };
const DOCENTE = { documento: "7200000009", rol: "docente" as const };
const ESTUDIANTE = { documento: "7200000010" };
const NUNCA_ACEPTO = { documento: "7200000011" };

const ids: Record<string, number> = {};

beforeAll(async () => {
  // Un solo hash para todos: cada uno cuesta 100.000 iteraciones
  const hash = await hashContrasena(CONTRASENA);
  const vigente = env.AVISO_PRIVACIDAD_VERSION;

  for (const u of [TEMPORAL, REGLAS]) {
    ids[u.documento] = await crearUsuario({ ...u, debeCambiarPassword: 1, avisoVersion: vigente }, hash);
  }
  for (const u of [VOLUNTARIO, OLVIDADIZO, BLOQUEADO, ADMIN, DOCENTE, ESTUDIANTE]) {
    ids[u.documento] = await crearUsuario({ ...u, avisoVersion: vigente }, hash);
  }
  ids[AVISO_VIEJO.documento] = await crearUsuario({ ...AVISO_VIEJO, avisoVersion: "2025-01" }, hash);
  // Como la cuenta de primer ingreso del seed: contraseña temporal y aviso nunca aceptado
  ids[SIN_NADA.documento] = await crearUsuario({ ...SIN_NADA, debeCambiarPassword: 1 }, hash);
  // Escenario "Primer ingreso": nunca aceptó el aviso, pero no tiene contraseña temporal (esa compuerta va primero)
  ids[NUNCA_ACEPTO.documento] = await crearUsuario(NUNCA_ACEPTO, hash);
});

const cambiarContrasena = (token: string, actual: string, nueva: string) =>
  pedir("/auth/contrasena", conCookie(token, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ actual, nueva }) }));

const aceptarAviso = (token: string) => pedir("/auth/aviso", conCookie(token, { method: "POST" }));

const restablecer = (token: string, id: number | string) =>
  pedir(`/usuarios/${id}/restablecer-contrasena`, conCookie(token, { method: "POST" }));

const filaDe = (id: number) =>
  env.DB.prepare(
    `SELECT password_hash, debe_cambiar_password, sesion_version, aviso_version_aceptada, aviso_aceptado_en
       FROM usuarios WHERE id = ?`,
  )
    .bind(id)
    .first<{
      password_hash: string;
      debe_cambiar_password: number;
      sesion_version: number;
      aviso_version_aceptada: string | null;
      aviso_aceptado_en: string | null;
    }>();

describe("POST /api/auth/contrasena: cambio obligatorio (primer ingreso)", () => {
  it("con la temporal como actual y una nueva válida: apaga la compuerta, cierra la sesión vieja y abre una nueva", async () => {
    const tokenViejo = await sesionDe(TEMPORAL.documento, CONTRASENA);

    const respuesta = await cambiarContrasena(tokenViejo, CONTRASENA, NUEVA);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ id: ids[TEMPORAL.documento], debeCambiarPassword: false });

    // La respuesta trae un token nuevo: con él ya se puede usar la plataforma (404, no 403 de la compuerta)
    const tokenNuevo = tokenDe(respuesta);
    expect((await pedir(RUTA_NO_DECLARADA, conCookie(tokenNuevo))).status).toBe(404);
    // El token anterior quedó revocado (sesion_version subió)
    expect((await pedir("/auth/yo", conCookie(tokenViejo))).status).toBe(401);

    // La contraseña cambió de verdad
    expect((await ingresar(TEMPORAL.documento, NUEVA)).status).toBe(200);
    expect((await ingresar(TEMPORAL.documento, CONTRASENA)).status).toBe(401);
  });

  it("Revisión de la base de datos: la base guarda solo el hash de la nueva, nunca el texto", async () => {
    const fila = await filaDe(ids[TEMPORAL.documento]);

    expect(fila?.password_hash).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(fila?.password_hash).not.toContain(NUEVA);
  });

  it("rechaza una nueva muy corta, igual al documento o igual a la temporal, y no cambia nada", async () => {
    const token = await sesionDe(REGLAS.documento, CONTRASENA);
    const antes = await filaDe(ids[REGLAS.documento]);

    const casos = [
      { nueva: "Corta12", codigo: "CONTRASENA_CORTA" },
      { nueva: REGLAS.documento, codigo: "CONTRASENA_IGUAL_DOCUMENTO" },
      { nueva: CONTRASENA, codigo: "CONTRASENA_IGUAL_ACTUAL" },
    ];
    for (const { nueva, codigo } of casos) {
      const respuesta = await cambiarContrasena(token, CONTRASENA, nueva);
      expect(respuesta.status).toBe(400);
      expect(await respuesta.json()).toMatchObject({ codigo });
      expect(respuesta.headers.get("Set-Cookie")).toBeNull();
    }

    expect(await filaDe(ids[REGLAS.documento])).toEqual(antes);
    // La sesión sigue igual: la compuerta sigue cerrada
    expect((await pedir(RUTA_NO_DECLARADA, conCookie(token))).status).toBe(403);
  });

  it("Contraseña actual incorrecta: rechaza el cambio y no cambia nada", async () => {
    const token = await sesionDe(REGLAS.documento, CONTRASENA);
    const antes = await filaDe(ids[REGLAS.documento]);

    const respuesta = await cambiarContrasena(token, "Incorrecta2026", NUEVA);

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({
      codigo: "CONTRASENA_ACTUAL_INCORRECTA",
      mensaje: "La contraseña actual no es correcta",
    });
    expect(await filaDe(ids[REGLAS.documento])).toEqual(antes);
    expect((await pedir("/auth/yo", conCookie(token))).status).toBe(200);
  });

  it("solicitud sin la contraseña actual o sin la nueva: 400 SOLICITUD_INVALIDA", async () => {
    const token = await sesionDe(REGLAS.documento, CONTRASENA);
    const respuesta = await pedir(
      "/auth/contrasena",
      conCookie(token, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ nueva: NUEVA }) }),
    );

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "SOLICITUD_INVALIDA" });
  });

  it("sin sesión responde 401", async () => {
    expect((await cambiarContrasena("", CONTRASENA, NUEVA)).status).toBe(401);
  });
});

describe("POST /api/auth/contrasena: cambio voluntario", () => {
  it("Cambio con la contraseña actual correcta / Cambio de contraseña desde otro equipo: la sesión actual sigue abierta y la del otro equipo responde no autenticado", async () => {
    const equipoA = await sesionDe(VOLUNTARIO.documento, CONTRASENA);
    const equipoB = await sesionDe(VOLUNTARIO.documento, CONTRASENA);

    const respuesta = await cambiarContrasena(equipoA, CONTRASENA, NUEVA);

    expect(respuesta.status).toBe(200);
    expect((await pedir("/auth/yo", conCookie(tokenDe(respuesta)))).status).toBe(200);
    expect((await pedir("/auth/yo", conCookie(equipoB))).status).toBe(401);
  });
});

describe("POST /api/auth/aviso", () => {
  it("Primer ingreso: quien nunca aceptó el aviso ingresa con la compuerta del aviso y no pasa de ahí hasta aceptarlo", async () => {
    const ingreso = await ingresar(NUNCA_ACEPTO.documento, CONTRASENA);
    expect(ingreso.status).toBe(200);
    // El frontend lee esta compuerta y muestra el aviso (web/src/sesion/destino.ts)
    expect(await ingreso.json()).toMatchObject({ debeCambiarPassword: false, debeAceptarAviso: true });

    const token = await sesionDe(NUNCA_ACEPTO.documento, CONTRASENA);
    const sinAceptar = await pedir(RUTA_NO_DECLARADA, conCookie(token));
    expect(sinAceptar.status).toBe(403);
    expect(await sinAceptar.json()).toMatchObject({ codigo: "DEBE_ACEPTAR_AVISO" });

    expect((await aceptarAviso(token)).status).toBe(200);
    expect((await pedir(RUTA_NO_DECLARADA, conCookie(token))).status).toBe(404);
  });

  it("guarda la versión vigente y la fecha de aceptación, y abre la compuerta del aviso", async () => {
    const token = await sesionDe(AVISO_VIEJO.documento, CONTRASENA);

    const respuesta = await aceptarAviso(token);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ debeAceptarAviso: false });
    const fila = await filaDe(ids[AVISO_VIEJO.documento]);
    expect(fila?.aviso_version_aceptada).toBe(env.AVISO_PRIVACIDAD_VERSION);
    expect(fila?.aviso_aceptado_en).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    // Aceptar el aviso no cambia la sesión: el mismo token ya pasa la compuerta
    expect((await pedir(RUTA_NO_DECLARADA, conCookie(token))).status).toBe(404);
  });

  it("se puede aceptar aunque falte cambiar la contraseña temporal, que sigue pendiente", async () => {
    const token = await sesionDe(SIN_NADA.documento, CONTRASENA);

    const respuesta = await aceptarAviso(token);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ debeCambiarPassword: true, debeAceptarAviso: false });
    expect(await (await pedir(RUTA_NO_DECLARADA, conCookie(token))).json()).toMatchObject({
      codigo: "DEBE_CAMBIAR_PASSWORD",
    });
  });

  it("sin sesión responde 401", async () => {
    expect((await aceptarAviso("")).status).toBe(401);
  });
});

describe("POST /api/usuarios/:id/restablecer-contrasena", () => {
  it("Estudiante olvidó su contraseña / Restablecimiento con sesión abierta: genera una temporal que se muestra una sola vez, obliga a cambiarla y cierra la sesión abierta del usuario", async () => {
    const sesionEstudiante = await sesionDe(OLVIDADIZO.documento, CONTRASENA);
    const admin = await sesionDe(ADMIN.documento, CONTRASENA);

    const respuesta = await restablecer(admin, ids[OLVIDADIZO.documento]);

    expect(respuesta.status).toBe(200);
    // Ni el navegador ni un proxy deben guardar una respuesta con una contraseña
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    const cuerpo = await respuesta.json<Record<string, string>>();
    // Solo la contraseña: nada de documento ni correo
    expect(Object.keys(cuerpo)).toEqual(["contrasenaTemporal"]);
    const temporal = cuerpo.contrasenaTemporal;
    expect(temporal).toHaveLength(10);
    for (const ch of temporal) expect(ALFABETO_TEMPORAL).toContain(ch);

    const fila = await filaDe(ids[OLVIDADIZO.documento]);
    expect(fila?.debe_cambiar_password).toBe(1);
    expect(fila?.password_hash).not.toContain(temporal);

    // La sesión que tenía abierta el estudiante quedó revocada; la del administrador sigue
    expect((await pedir("/auth/yo", conCookie(sesionEstudiante))).status).toBe(401);
    expect((await pedir("/auth/yo", conCookie(admin))).status).toBe(200);

    // Entra con la temporal y debe cambiarla; la contraseña anterior ya no sirve
    expect(await (await ingresar(OLVIDADIZO.documento, temporal)).json()).toMatchObject({ debeCambiarPassword: true });
    expect((await ingresar(OLVIDADIZO.documento, CONTRASENA)).status).toBe(401);
  });

  it("Estudiante bloqueado por intentos fallidos: con la contraseña temporal que le da el administrador ingresa de inmediato, sin esperar 15 minutos", async () => {
    for (let i = 0; i < 5; i++) await ingresar(BLOQUEADO.documento, "Incorrecta2026");
    expect((await ingresar(BLOQUEADO.documento, CONTRASENA)).status).toBe(429);

    const admin = await sesionDe(ADMIN.documento, CONTRASENA);
    const { contrasenaTemporal } = await (await restablecer(admin, ids[BLOQUEADO.documento])).json<{ contrasenaTemporal: string }>();

    expect((await ingresar(BLOQUEADO.documento, contrasenaTemporal)).status).toBe(200);
  });

  it("solo el administrador: docente y estudiante reciben 403 ACCESO_DENEGADO y nada cambia", async () => {
    const antes = await filaDe(ids[ESTUDIANTE.documento]);

    for (const quien of [DOCENTE, ESTUDIANTE]) {
      const token = await sesionDe(quien.documento, CONTRASENA);
      const respuesta = await restablecer(token, ids[ESTUDIANTE.documento]);
      expect(respuesta.status).toBe(403);
      expect(await respuesta.json()).toMatchObject({ codigo: "ACCESO_DENEGADO" });
    }

    expect(await filaDe(ids[ESTUDIANTE.documento])).toEqual(antes);
  });

  it("un usuario que no existe o un id que no es número: 404 USUARIO_NO_ENCONTRADO", async () => {
    const admin = await sesionDe(ADMIN.documento, CONTRASENA);

    for (const id of [999_999, "abc", "0"]) {
      const respuesta = await restablecer(admin, id);
      expect(respuesta.status).toBe(404);
      expect(await respuesta.json()).toEqual({ codigo: "USUARIO_NO_ENCONTRADO", mensaje: "El usuario no existe" });
    }
  });
});
