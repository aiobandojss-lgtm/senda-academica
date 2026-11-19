import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearCuota, crearEstudiante, crearExcepcion, crearUsuario, fechaDesdeHoy, ingresar, llamar, sesionDe } from "./utilidades";

// Tarea 5.4: excepciones de mora (spec `bloqueo-mora`, "Excepciones autorizadas")

const CONTRASENA = "Prueba2026*";

let admin: string;
let adminId: number;
let tokenDocente: string;
let hash: string;
let carreraId: number;
let siguiente = 7410000100;

async function bloqueado() {
  const documento = String(siguiente++);
  const id = await crearEstudiante({ documento, carreraId, semestre: 1 }, hash);
  await crearCuota(id, fechaDesdeHoy(-45));
  return { id, documento };
}

const excepcion = (id: number, cuerpo: Record<string, unknown>, token = admin) => llamar(token, "POST", `/estudiantes/${id}/excepciones`, cuerpo);

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  adminId = await crearUsuario({ documento: "7410000001", rol: "admin", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  await crearUsuario({ documento: "7410000002", rol: "docente", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  carreraId = await crearCarrera("TL-EXC");
  admin = await sesionDe("7410000001", CONTRASENA);
  tokenDocente = await sesionDe("7410000002", CONTRASENA);
});

describe("POST /api/estudiantes/:id/excepciones", () => {
  it("Estudiante en mora con excepción (acuerdo de pago): el estudiante en mora ingresa y aparece con estado con excepción", async () => {
    const { id, documento } = await bloqueado();
    expect((await ingresar(documento, CONTRASENA)).status).toBe(403);

    const respuesta = await excepcion(id, { motivo: "acuerdo de pago", hasta: fechaDesdeHoy(10) });

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toMatchObject({ motivo: "acuerdo de pago", hasta: fechaDesdeHoy(10), vigente: true });
    expect((await ingresar(documento, CONTRASENA)).status).toBe(200);
    const lista = await (await llamar(admin, "GET", `/estudiantes?estado=con_excepcion&carrera=${carreraId}`)).json<{ id: number }[]>();
    expect(lista.map((e) => e.id)).toContain(id);
    const cuenta = await (await llamar(admin, "GET", `/estudiantes/${id}/estado-cuenta`)).json<{ estadoCartera: string; excepciones: unknown[] }>();
    expect(cuenta.estadoCartera).toBe("con_excepcion");
    expect(cuenta.excepciones).toHaveLength(1);
  });

  it("vale hasta su fecha final inclusive: con fecha de hoy, ingresa", async () => {
    const { id, documento } = await bloqueado();

    expect((await excepcion(id, { motivo: "acuerdo de pago", hasta: fechaDesdeHoy(0) })).status).toBe(201);

    expect((await ingresar(documento, CONTRASENA)).status).toBe(200);
  });

  it("excepción con fecha pasada: se rechaza", async () => {
    const { id } = await bloqueado();

    const respuesta = await excepcion(id, { motivo: "acuerdo de pago", hasta: fechaDesdeHoy(-1) });

    expect(respuesta.status).toBe(400);
    const error = await respuesta.json<{ campo: string; mensaje: string }>();
    expect(error.campo).toBe("hasta");
    expect(error.mensaje).toContain("hoy");
  });

  it("excepción vencida: si la mora sigue, el estudiante vuelve a estar bloqueado", async () => {
    const { id, documento } = await bloqueado();
    await crearExcepcion(id, fechaDesdeHoy(-1), adminId);

    expect((await ingresar(documento, CONTRASENA)).status).toBe(403);
  });

  it("exige motivo, y solo la crea el administrador", async () => {
    const { id } = await bloqueado();

    expect((await excepcion(id, { motivo: " ", hasta: fechaDesdeHoy(5) })).status).toBe(400);
    expect((await excepcion(id, { motivo: "acuerdo", hasta: fechaDesdeHoy(5) }, tokenDocente)).status).toBe(403);
    expect((await excepcion(999999, { motivo: "acuerdo", hasta: fechaDesdeHoy(5) })).status).toBe(404);
  });
});
