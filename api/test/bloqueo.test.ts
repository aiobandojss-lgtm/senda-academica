import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { conCookie, crearCarrera, crearCuota, crearEstudiante, crearUsuario, fechaDesdeHoy, ingresar, llamar, pedir, sesionDe } from "./utilidades";

// Tarea 5.3: bloqueo por mora al ingresar y en cada petición (spec `bloqueo-mora`, design.md D6)

const CONTRASENA = "Prueba2026*";

let admin: string;
let hash: string;
let carreraId: number;
let siguiente = 7400000100;

// Estudiante nuevo con una cuota de 250.000 que venció hace `diasAtraso` días (o ninguna si es null)
async function estudianteConMora(diasAtraso: number | null) {
  const documento = String(siguiente++);
  const id = await crearEstudiante({ documento, carreraId, semestre: 1 }, hash);
  if (diasAtraso !== null) await crearCuota(id, fechaDesdeHoy(-diasAtraso));
  return { id, documento };
}

beforeAll(async () => {
  hash = await hashContrasena(CONTRASENA);
  await crearUsuario({ documento: "7400000001", rol: "admin", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  await crearUsuario({ documento: "7400000002", rol: "docente", avisoVersion: env.AVISO_PRIVACIDAD_VERSION }, hash);
  carreraId = await crearCarrera("TL-BLQ");
  admin = await sesionDe("7400000001", CONTRASENA);
});

describe("al ingresar", () => {
  it("intento de ingreso bloqueado: no inicia sesión y muestra el acceso suspendido con el contacto de la Fundación", async () => {
    const { documento } = await estudianteConMora(45);

    const respuesta = await ingresar(documento, CONTRASENA);

    expect(respuesta.status).toBe(403);
    expect(respuesta.headers.get("Set-Cookie")).toBeNull();
    const error = await respuesta.json<{ codigo: string; mensaje: string }>();
    expect(error.codigo).toBe("ACCESO_SUSPENDIDO");
    expect(error.mensaje).toContain("suspendido");
    expect(error.mensaje).toContain(env.CONTACTO_FUNDACION);
  });

  it("con la contraseña incorrecta no revela que está bloqueado: mensaje genérico", async () => {
    const { documento } = await estudianteConMora(45);

    const respuesta = await ingresar(documento, "otra-contrasena");

    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ codigo: "CREDENCIALES_INVALIDAS" });
  });

  it("pago que salda la cuota: el estudiante puede ingresar de inmediato", async () => {
    const { id, documento } = await estudianteConMora(45);
    expect((await ingresar(documento, CONTRASENA)).status).toBe(403);
    const cuota = await env.DB.prepare("SELECT id FROM cuotas WHERE estudiante_id = ?").bind(id).first<{ id: number }>();

    await llamar(admin, "POST", `/cuotas/${cuota?.id}/pagos`, { valor: 250_000, fechaPago: fechaDesdeHoy(0), medio: "efectivo" });

    expect((await ingresar(documento, CONTRASENA)).status).toBe(200);
  });

  it("Estudiante en riesgo: con la cuota vencida hace 10 días, y con 30 días exactos, todavía ingresa", async () => {
    expect((await ingresar((await estudianteConMora(10)).documento, CONTRASENA)).status).toBe(200);
    expect((await ingresar((await estudianteConMora(30)).documento, CONTRASENA)).status).toBe(200);
    expect((await ingresar((await estudianteConMora(31)).documento, CONTRASENA)).status).toBe(403);
  });

  it("Docente sin cuotas: el bloqueo solo aplica a estudiantes y el docente ingresa sin evaluar la mora", async () => {
    expect((await ingresar("7400000002", CONTRASENA)).status).toBe(200);
  });
});

describe("en cada petición", () => {
  it("se cumple la mora con la sesión abierta: la siguiente petición se rechaza, también la de su perfil", async () => {
    const { id, documento } = await estudianteConMora(null);
    const sesion = await sesionDe(documento, CONTRASENA);
    expect((await pedir("/cursos", conCookie(sesion))).status).toBe(200);

    await crearCuota(id, fechaDesdeHoy(-40));

    const cursos = await pedir("/cursos", conCookie(sesion));
    expect(cursos.status).toBe(403);
    expect(await cursos.json()).toMatchObject({ codigo: "ACCESO_SUSPENDIDO" });
    // Bloqueado no ve nada, tampoco su estado de cuenta ni su perfil
    expect((await pedir("/estado-cuenta", conCookie(sesion))).status).toBe(403);
    expect((await pedir("/auth/yo", conCookie(sesion))).status).toBe(403);
  });

  it("sí puede cerrar su sesión", async () => {
    const { id, documento } = await estudianteConMora(null);
    const sesion = await sesionDe(documento, CONTRASENA);
    await crearCuota(id, fechaDesdeHoy(-40));

    expect((await pedir("/auth/salir", conCookie(sesion, { method: "POST" }))).status).toBe(204);
  });
});
