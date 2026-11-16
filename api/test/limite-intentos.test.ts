import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearUsuario, ingresar } from "./utilidades";

// Requisito "Límite de intentos de ingreso" de la spec `autenticacion` (design.md D14).
// Cada prueba usa su propio documento: la D1 se comparte entre las pruebas de este archivo.

const CONTRASENA = "Prueba2026*";
const INCORRECTA = "Prueba2026+";
const DEMASIADOS_INTENTOS = { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos. Intenta de nuevo en 15 minutos" };

const SEXTO = "7100000001";
const REINICIO = "7100000002";
const VENTANA = "7100000003";
const SIMULTANEOS = "7100000004";
const INEXISTENTE = "7100000999";

const filasDe = async (documento: string) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM intentos_fallidos WHERE documento = ?").bind(documento).first<number>("n")) ?? 0;

// Registra fallos con una fecha en el pasado, para probar la ventana sin esperar 15 minutos reales
async function fallosAntiguos(documento: string, cantidad: number, haceCuanto: string) {
  const insertar = env.DB.prepare(
    "INSERT INTO intentos_fallidos (documento, creado_en) VALUES (?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?))",
  );
  await env.DB.batch(Array.from({ length: cantidad }, () => insertar.bind(documento, haceCuanto)));
}

beforeAll(async () => {
  const hash = await hashContrasena(CONTRASENA);
  const aviso = env.AVISO_PRIVACIDAD_VERSION;
  for (const documento of [SEXTO, REINICIO, VENTANA, SIMULTANEOS]) {
    await crearUsuario({ documento, avisoVersion: aviso }, hash);
  }
});

describe("límite de intentos de ingreso (D14)", () => {
  it("sexto intento después de cinco fallos: no inicia sesión aunque la contraseña sea correcta", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await ingresar(SEXTO, INCORRECTA)).status).toBe(401);
    }

    const sexto = await ingresar(SEXTO, CONTRASENA);

    expect(sexto.status).toBe(429);
    expect(await sexto.json()).toEqual(DEMASIADOS_INTENTOS);
    expect(sexto.headers.get("Set-Cookie")).toBeNull();
  });

  it("documento inexistente con muchos intentos: el mismo mensaje que para un documento existente", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await ingresar(INEXISTENTE, CONTRASENA)).status).toBe(401);
    }

    const sexto = await ingresar(INEXISTENTE, CONTRASENA);

    expect(sexto.status).toBe(429);
    expect(await sexto.json()).toEqual(DEMASIADOS_INTENTOS);
  });

  it("ingreso exitoso reinicia el conteo: después de 3 fallos entra y el conteo vuelve a cero", async () => {
    for (let i = 1; i <= 3; i++) await ingresar(REINICIO, INCORRECTA);
    expect(await filasDe(REINICIO)).toBe(3);

    expect((await ingresar(REINICIO, CONTRASENA)).status).toBe(200);
    expect(await filasDe(REINICIO)).toBe(0);

    // Sin el reinicio, el tercero de estos fallos ya sería el sexto intento
    for (let i = 1; i <= 5; i++) {
      expect((await ingresar(REINICIO, INCORRECTA)).status).toBe(401);
    }
  });

  it("solo cuentan los fallos de los últimos 15 minutos", async () => {
    await fallosAntiguos(VENTANA, 5, "-16 minutes");
    expect((await ingresar(VENTANA, CONTRASENA)).status).toBe(200);

    await fallosAntiguos(VENTANA, 5, "-14 minutes");
    expect((await ingresar(VENTANA, CONTRASENA)).status).toBe(429);
  });

  it("10 intentos simultáneos: solo 5 llegan a verificar la contraseña y el resto se bloquea", async () => {
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => ingresar(SIMULTANEOS, INCORRECTA)));
    const estados = respuestas.map((r) => r.status);

    expect(estados.filter((e) => e === 401)).toHaveLength(5);
    expect(estados.filter((e) => e === 429)).toHaveLength(5);
    // Los intentos bloqueados no dejan fila: así no alargan el bloqueo
    expect(await filasDe(SIMULTANEOS)).toBe(5);
  });

  it("borra de paso los registros de más de un día, de cualquier documento", async () => {
    await fallosAntiguos("7100000555", 2, "-2 days");
    await fallosAntiguos("7100000556", 1, "-2 hours");

    await ingresar("7100000557", INCORRECTA);

    expect(await filasDe("7100000555")).toBe(0);
    expect(await filasDe("7100000556")).toBe(1);
  });
});
