import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { conCookie, crearCarrera, crearUsuario, ingresar, llamar, pedir, sesionDe } from "./utilidades";

// Tarea 3.1: registro de docentes y su desactivación (spec `carreras-estudiantes`, design.md D4 y D17)

const CONTRASENA = "Prueba2026*";
const aviso = () => env.AVISO_PRIVACIDAD_VERSION;

let hash: string;
let admin: string;
let adminId: number;
let tokenDocente: string;

type Docente = {
  id: number;
  tipoDocumento: string;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular: string | null;
  activo: boolean;
  cursosActivos: number;
};

const nuevoDocente = (documento: string, extra: Record<string, unknown> = {}) => ({
  tipoDocumento: "CC",
  documento,
  nombres: "Marta Lucía",
  apellidos: "Gómez Ruiz",
  correo: " Marta.Gomez@Correo.TEST ",
  ...extra,
});

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  adminId = await crearUsuario({ documento: "7330000001", rol: "admin", avisoVersion: aviso() }, hash);
  await crearUsuario({ documento: "7330000002", rol: "docente", avisoVersion: aviso() }, hash);
  admin = await sesionDe("7330000001", CONTRASENA);
  tokenDocente = await sesionDe("7330000002", CONTRASENA);
});

describe("POST /api/docentes", () => {
  it("registra al docente con una contraseña temporal que se muestra una sola vez", async () => {
    const respuesta = await llamar(admin, "POST", "/docentes", nuevoDocente("7330000101", { celular: "300 123 4567" }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    const { docente, contrasenaTemporal } = await respuesta.json<{ docente: Docente; contrasenaTemporal: string }>();
    expect(docente).toMatchObject({
      tipoDocumento: "CC",
      documento: "7330000101",
      nombres: "Marta Lucía",
      correo: "marta.gomez@correo.test",
      celular: "3001234567",
      activo: true,
      cursosActivos: 0,
    });
    expect(contrasenaTemporal).toHaveLength(10);

    // La base guarda solo el hash, y el docente queda obligado a cambiarla (D16, D17)
    const fila = await env.DB.prepare("SELECT rol, password_hash, debe_cambiar_password FROM usuarios WHERE id = ?")
      .bind(docente.id)
      .first<{ rol: string; password_hash: string; debe_cambiar_password: number }>();
    expect(fila).toMatchObject({ rol: "docente", debe_cambiar_password: 1 });
    expect(fila?.password_hash).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(fila?.password_hash).not.toContain(contrasenaTemporal);

    // Puede iniciar sesión con ella
    const ingreso = await ingresar("7330000101", contrasenaTemporal);
    expect(ingreso.status).toBe(200);
    expect(await ingreso.json()).toMatchObject({ rol: "docente", debeCambiarPassword: true });
  });

  it("rechaza un documento ya registrado por cualquier usuario e indica cuál", async () => {
    const respuesta = await llamar(admin, "POST", "/docentes", nuevoDocente("7330000002"));

    expect(respuesta.status).toBe(409);
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("DOCUMENTO_REPETIDO");
    expect(error.mensaje).toContain("7330000002");
  });

  it("rechaza un correo inválido señalando el campo", async () => {
    const respuesta = await llamar(admin, "POST", "/docentes", nuevoDocente("7330000102", { correo: "sin-arroba" }));

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ codigo: "SOLICITUD_INVALIDA", campo: "correo" });
  });

  it("rechaza un documento con puntos o espacios", async () => {
    const respuesta = await llamar(admin, "POST", "/docentes", nuevoDocente("1.234.567"));

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ campo: "documento" });
  });

  it("solo la usa el administrador", async () => {
    const respuesta = await llamar(tokenDocente, "POST", "/docentes", nuevoDocente("7330000103"));

    expect(respuesta.status).toBe(403);
  });
});

describe("GET /api/docentes y PATCH /api/docentes/:id", () => {
  it("lista los docentes con sus cursos activos", async () => {
    const id = await crearUsuario({ documento: "7330000201", rol: "docente", apellidos: "Zúñiga" }, hash);
    const carreraId = await crearCarrera("TL-DOC");
    await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Uno", semestre: 1, docenteId: id });

    const lista = await (await llamar(admin, "GET", "/docentes")).json<Docente[]>();

    expect(lista.find((d) => d.id === id)).toMatchObject({ documento: "7330000201", cursosActivos: 1, activo: true });
    expect(lista.every((d) => d.id !== adminId)).toBe(true);
  });

  it("edita los datos del docente", async () => {
    const id = await crearUsuario({ documento: "7330000202", rol: "docente" }, hash);

    const respuesta = await llamar(admin, "PATCH", `/docentes/${id}`, { nombres: "Luis", correo: "luis@correo.test", celular: "" });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ id, nombres: "Luis", correo: "luis@correo.test", celular: null });
  });

  it("no edita por esta ruta a quien no es docente", async () => {
    const respuesta = await llamar(admin, "PATCH", `/docentes/${adminId}`, { nombres: "Otro" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCENTE_NO_ENCONTRADO" });
  });

  it("rechaza cambiar el documento por uno ya registrado", async () => {
    const id = await crearUsuario({ documento: "7330000203", rol: "docente" }, hash);

    const respuesta = await llamar(admin, "PATCH", `/docentes/${id}`, { documento: "7330000001" });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ codigo: "DOCUMENTO_REPETIDO" });
  });
});

describe("desactivar y reactivar un docente", () => {
  it("docente desactivado con cursos: no ingresa, pierde su sesión y sus cursos lo conservan", async () => {
    const id = await crearUsuario({ documento: "7330000301", rol: "docente", avisoVersion: aviso() }, hash);
    const carreraId = await crearCarrera("TL-RETIRO");
    const curso = await (
      await llamar(admin, "POST", "/cursos", { carreraId, nombre: "Del retirado", semestre: 1, docenteId: id })
    ).json<{ id: number }>();
    const sesion = await sesionDe("7330000301", CONTRASENA);

    const respuesta = await llamar(admin, "POST", `/usuarios/${id}/desactivar`);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ id, activo: false });
    expect((await pedir("/auth/yo", conCookie(sesion))).status).toBe(401);
    expect((await ingresar("7330000301", CONTRASENA)).status).toBe(403);
    const cursos = await (await llamar(admin, "GET", `/cursos?carrera=${carreraId}`)).json<{ id: number; docente: { id: number; activo: boolean } }[]>();
    expect(cursos.find((c) => c.id === curso.id)?.docente).toMatchObject({ id, activo: false });
  });

  it("al reactivarlo vuelve a ingresar con su contraseña", async () => {
    const id = await crearUsuario({ documento: "7330000302", rol: "docente", activo: 0, avisoVersion: aviso() }, hash);

    const respuesta = await llamar(admin, "POST", `/usuarios/${id}/reactivar`);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ id, activo: true });
    expect((await ingresar("7330000302", CONTRASENA)).status).toBe(200);
  });

  it("no desactiva administradores", async () => {
    const respuesta = await llamar(admin, "POST", `/usuarios/${adminId}/desactivar`);

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toMatchObject({ codigo: "USUARIO_NO_ENCONTRADO" });
  });

  it("solo la usa el administrador", async () => {
    const id = await crearUsuario({ documento: "7330000303", rol: "docente" }, hash);

    const respuesta = await llamar(tokenDocente, "POST", `/usuarios/${id}/desactivar`);

    expect(respuesta.status).toBe(403);
  });
});
