import { createExecutionContext, createScheduledController, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import { depurarAsistente } from "../src/rag/depuracion";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { crearCarrera, crearEstudiante } from "./utilidades";

// Tarea RAG 3.5: retención de 30 días de las conversaciones del asistente (spec `asistente-academico`, design.md
// D10). Los mensajes pueden traer datos personales que el estudiante escribe: no se guardan más de lo necesario.

// 31 de diciembre a las 3:00 a. m. de Colombia (08:00 UTC), la hora del Cron Trigger
const AHORA = new Date("2026-12-31T08:00:00Z");

let estudianteId: number;

const sembrarMensaje = (contenido: string, creadoEn: string) =>
  env.DB.prepare("INSERT INTO asistente_mensajes (usuario_id, rol, contenido, creado_en) VALUES (?, 'usuario', ?, ?)")
    .bind(estudianteId, contenido, creadoEn)
    .run();
const sembrarContador = (fecha: string) =>
  env.DB.prepare("INSERT INTO asistente_uso (usuario_id, fecha, preguntas) VALUES (?, ?, 3)").bind(estudianteId, fecha).run();
const mensajes = async () =>
  (await env.DB.prepare("SELECT contenido FROM asistente_mensajes ORDER BY id").all<{ contenido: string }>()).results.map((m) => m.contenido);
const contadores = async () =>
  (await env.DB.prepare("SELECT fecha FROM asistente_uso ORDER BY fecha").all<{ fecha: string }>()).results.map((c) => c.fecha);

beforeAll(async () => {
  estudianteId = await crearEstudiante({ documento: "8350000001", carreraId: await crearCarrera("TL-DP"), semestre: 1 }, await hashContrasena("Prueba2026*"));
});

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare("DELETE FROM asistente_mensajes"), env.DB.prepare("DELETE FROM asistente_uso")]);
});

describe("Depuración diaria del asistente (D10)", () => {
  it("borra los mensajes de más de 30 días y conserva los recientes", async () => {
    await sembrarMensaje("hace 30 días y un segundo", "2026-12-01T07:59:59Z");
    await sembrarMensaje("hace 30 días justos", "2026-12-01T08:00:00Z");
    await sembrarMensaje("de ayer", "2026-12-30T15:00:00Z");

    const borrados = await depurarAsistente(env.DB, AHORA);

    expect(await mensajes()).toEqual(["hace 30 días justos", "de ayer"]);
    expect(borrados.mensajes).toBe(1);
  });

  it("borra los contadores del límite diario de más de 30 días (en fechas de Colombia)", async () => {
    // Hoy en Colombia es 2026-12-31: el 30 de noviembre tiene 31 días, el 1 de diciembre tiene 30
    await sembrarContador("2026-11-30");
    await sembrarContador("2026-12-01");
    await sembrarContador("2026-12-31");

    const borrados = await depurarAsistente(env.DB, AHORA);

    expect(await contadores()).toEqual(["2026-12-01", "2026-12-31"]);
    expect(borrados.contadores).toBe(1);
  });

  it("el Cron Trigger del Worker ejecuta la depuración", async () => {
    await sembrarMensaje("viejo", "2026-10-01T12:00:00Z");
    await sembrarMensaje("reciente", "2026-12-30T12:00:00Z");
    const contexto = createExecutionContext();

    await worker.scheduled(createScheduledController({ scheduledTime: AHORA, cron: "0 8 * * *" }), env, contexto);
    await waitOnExecutionContext(contexto);

    expect(await mensajes()).toEqual(["reciente"]);
  });
});
