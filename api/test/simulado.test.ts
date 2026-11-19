import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { responderPregunta } from "../src/rag/agente";
import type { ContextoHerramientas } from "../src/rag/herramientas";
import { EmbeddingsSimulados, IndiceSimulado, ModeloSimulado, usarModoSimulado } from "../src/rag/simulado";
import { crearCarrera } from "./utilidades";

// Tarea RAG 4.2: modo simulado del asistente para la prueba E2E (RAG design.md D7). El E2E corre sin credenciales de
// Cloudflare, así que no hay Workers AI ni Vectorize: con MODELO_SIMULADO=1 el modelo y la búsqueda se simulan con
// reglas fijas sobre los fragmentos de D1. Nunca debe activarse en producción: solo funciona en localhost.

const LOCAL = "http://localhost:4173/api/asistente/mensajes";
const NOTA_MINIMA = "¿Cuál es la nota mínima para aprobar un curso?";
const CAFETERIA = "¿Cuál es el horario de la cafetería?";

let carreraPropia: number;
let otraCarrera: number;
let evaluacionId: number;
let planOtraCarreraId: number;

async function crearDocumento(clave: string, titulo: string, carreraId: number | null, secciones: [string, string][]) {
  await env.DB.prepare("INSERT INTO documentos (clave, titulo, tipo, carrera_id, contenido) VALUES (?, ?, 'reglamento', ?, 'x')")
    .bind(clave, titulo, carreraId)
    .run();
  const ids: number[] = [];
  for (const [orden, [seccion, contenido]] of secciones.entries()) {
    const { meta } = await env.DB.prepare(
      "INSERT INTO fragmentos (documento_id, orden, seccion, contenido) VALUES ((SELECT id FROM documentos WHERE clave = ?), ?, ?, ?)",
    )
      .bind(clave, orden, seccion, contenido)
      .run();
    ids.push(meta.last_row_id);
  }
  return ids;
}

const contexto = (carreraId: number): ContextoHerramientas => ({
  db: env.DB,
  estudianteId: 1,
  carreraId,
  embeddings: new EmbeddingsSimulados(),
  indice: new IndiceSimulado(env.DB),
});

const buscar = async (texto: string, carreraId: number) => {
  const [vector] = await new EmbeddingsSimulados().generar([texto]);
  return new IndiceSimulado(env.DB).buscar(vector, { carreraId, maximo: 10 });
};

beforeAll(async () => {
  carreraPropia = await crearCarrera("TL-SIM");
  otraCarrera = await crearCarrera("TL-OTRA");
  [evaluacionId] = await crearDocumento("reglamento-sim", "Reglamento estudiantil", null, [
    ["Evaluación y calificaciones", "Las notas se expresan de 0.0 a 5.0, con un decimal. La nota mínima para aprobar un curso es 3.0."],
    ["Entregas de talleres", "Los talleres se entregan por la plataforma, en PDF o Word."],
  ]);
  [planOtraCarreraId] = await crearDocumento("plan-otra", "Plan de estudios de otra carrera", otraCarrera, [
    ["Requisitos de grado", "Aprobar cada curso con nota mínima de 3.5."],
  ]);
});

describe("usarModoSimulado: solo en localhost", () => {
  it("con MODELO_SIMULADO=1 se usa en localhost, 127.0.0.1 y [::1]", () => {
    for (const url of [LOCAL, "http://127.0.0.1:4173/api/x", "http://[::1]:5173/api/x"]) {
      expect(usarModoSimulado({ ...env, MODELO_SIMULADO: "1" }, url), url).toBe(true);
    }
  });

  it("fuera de localhost se ignora aunque valga 1, y queda registrado como error", () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(usarModoSimulado({ ...env, MODELO_SIMULADO: "1" }, "https://senda.creativebycode.workers.dev/api/asistente/mensajes")).toBe(false);
      expect(registro).toHaveBeenCalledWith(expect.stringContaining("MODELO_SIMULADO"));
    } finally {
      registro.mockRestore();
    }
  });

  it("con el valor de wrangler.jsonc (0) nunca se usa", () => {
    expect(env.MODELO_SIMULADO).toBe("0");
    expect(usarModoSimulado(env, LOCAL)).toBe(false);
  });
});

describe("Búsqueda simulada sobre los fragmentos de D1", () => {
  it("encuentra el fragmento que tiene todas las palabras clave de la pregunta, con similitud 1", async () => {
    const [primera] = await buscar(NOTA_MINIMA, carreraPropia);
    expect(primera).toEqual({ fragmentoId: evaluacionId, similitud: 1 });
  });

  it("solo busca en los documentos generales y en los de la carrera del estudiante", async () => {
    const ids = (await buscar(NOTA_MINIMA, carreraPropia)).map((c) => c.fragmentoId);
    expect(ids).not.toContain(planOtraCarreraId);
    expect((await buscar(NOTA_MINIMA, otraCarrera)).map((c) => c.fragmentoId)).toContain(planOtraCarreraId);
  });

  it("una pregunta sin palabras en común con los documentos no encuentra nada", async () => {
    expect(await buscar(CAFETERIA, carreraPropia)).toEqual([]);
  });
});

describe("Modelo simulado con el agente real", () => {
  const preguntar = (pregunta: string) =>
    responderPregunta({
      modelo: new ModeloSimulado(),
      contexto: contexto(carreraPropia),
      perfil: { nombrePila: "Paola", carrera: "Técnico Laboral en Simulación" },
      config: { producto: env.PRODUCTO_NOMBRE, fundacion: env.FUNDACION_NOMBRE, contacto: env.CONTACTO_FUNDACION },
      historial: [],
      pregunta,
    });

  it("busca en los documentos y responde con la frase más parecida y su cita: la validación de citas la acepta", async () => {
    const resultado = await preguntar(NOTA_MINIMA);
    expect(resultado).toMatchObject({
      respuesta: "La nota mínima para aprobar un curso es 3.0. [Reglamento estudiantil – Evaluación y calificaciones]",
      fuentes: [{ documento: "Reglamento estudiantil", seccion: "Evaluación y calificaciones" }],
      reemplazada: false,
      herramientas: ["buscar_documentos"],
    });
  });

  it("sin resultados responde que no tiene la información, con el contacto de la Fundación", async () => {
    const resultado = await preguntar(CAFETERIA);
    expect(resultado.respuesta).toBe(`No tengo esa información. Te sugiero consultarlo con ${env.CONTACTO_FUNDACION}.`);
    expect(resultado.fuentes).toEqual([]);
  });
});
