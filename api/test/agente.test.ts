import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAXIMO_PASOS, responderPregunta, type EntradaAgente } from "../src/rag/agente";
import type { ContextoHerramientas } from "../src/rag/herramientas";
import type { RespuestaModelo } from "../src/rag/modelo";
import { EmbeddingsWorkersAi, IndiceVectorize, ServicioIaNoDisponible } from "../src/rag/servicios";
import { hashContrasena } from "../src/seguridad/contrasenas";
import { AiFalsa, dice, direccion, ModeloGuionado, pide, VectorizeFalso } from "./ia-falsa";
import { crearCarrera, crearCuota, crearEstudiante, fechaDesdeHoy } from "./utilidades";

// Tarea RAG 3.2: ciclo del agente con function calling (máximo 4 pasos), instrucciones del sistema y validación de
// citas (spec `asistente-academico`; design.md D4 a D6). El modelo es simulado con un guion: las pruebas no gastan
// cuota y deciden exactamente qué "responde" el modelo, incluso cuando se equivoca.

const ANA = { documento: "8320000021", celular: "3007778899" };
const NOTA_MINIMA = "nota mínima para aprobar";
const CAFETERIA = "horario de la cafetería";

let anaId: number;
let carreraId: number;
let ai: AiFalsa;
let vectores: VectorizeFalso;

const contexto = (): ContextoHerramientas => ({
  db: env.DB,
  estudianteId: anaId,
  carreraId,
  embeddings: new EmbeddingsWorkersAi(ai as unknown as Ai, env.MODELO_EMBEDDINGS),
  indice: new IndiceVectorize(vectores as unknown as VectorizeIndex, "produccion"),
});

const preguntar = (modelo: ModeloGuionado, pregunta: string, extra: Partial<EntradaAgente> = {}) =>
  responderPregunta({
    modelo,
    contexto: contexto(),
    perfil: { nombrePila: "Ana", carrera: "Técnico Laboral en Agentes" },
    config: { producto: env.PRODUCTO_NOMBRE, fundacion: env.FUNDACION_NOMBRE, contacto: env.CONTACTO_FUNDACION },
    historial: [],
    pregunta,
    ...extra,
  });

beforeAll(async () => {
  const hash = await hashContrasena("Prueba2026*");
  carreraId = await crearCarrera("TL-AG");
  anaId = await crearEstudiante({ documento: ANA.documento, carreraId, semestre: 1 }, hash);
  await env.DB.prepare("UPDATE usuarios SET nombres = 'Ana María', apellidos = 'Ríos Lara', celular = ? WHERE id = ?").bind(ANA.celular, anaId).run();
  await crearCuota(anaId, fechaDesdeHoy(-10), 180_000);
  await env.DB.prepare("INSERT INTO documentos (clave, titulo, tipo, contenido) VALUES ('reglamento', 'Reglamento estudiantil', 'reglamento', 'x')").run();
  const { meta } = await env.DB.prepare(
    "INSERT INTO fragmentos (documento_id, orden, seccion, contenido) VALUES ((SELECT id FROM documentos WHERE clave = 'reglamento'), 0, 'Evaluación y calificaciones', 'La nota mínima para aprobar un curso es 3.0.')",
  ).run();
  // El índice se llena en cada prueba con este id
  fragmentoId = meta.last_row_id;
});
let fragmentoId: number;

beforeEach(() => {
  ai = new AiFalsa();
  vectores = new VectorizeFalso();
  vectores.vectores.set(`produccion:${fragmentoId}`, {
    id: `produccion:${fragmentoId}`,
    values: direccion({ 0: 1 }),
    namespace: "produccion",
    metadata: { carrera_id: 0, tipo: "reglamento" },
  });
  ai.fijarVector(NOTA_MINIMA, direccion({ 0: 1 }));
  ai.fijarVector(CAFETERIA, direccion({ 7: 1 }));
});

describe("Respuestas basadas en documentos, con cita", () => {
  it("busca, recibe el fragmento y responde con la cita: la respuesta trae sus fuentes", async () => {
    const modelo = new ModeloGuionado([
      pide("buscar_documentos", { consulta: NOTA_MINIMA }),
      dice("La nota mínima para aprobar un curso es 3.0 [Reglamento estudiantil – Evaluación y calificaciones]."),
    ]);

    const resultado = await preguntar(modelo, "¿Cuál es la nota mínima para aprobar?");

    expect(resultado).toMatchObject({
      respuesta: "La nota mínima para aprobar un curso es 3.0 [Reglamento estudiantil – Evaluación y calificaciones].",
      fuentes: [{ documento: "Reglamento estudiantil", seccion: "Evaluación y calificaciones" }],
      reemplazada: false,
      pasos: 2,
      herramientas: ["buscar_documentos"],
    });
    // En el segundo paso el modelo recibió el resultado de la herramienta, con la cita armada
    const resultadoHerramienta = modelo.recibidos[1].at(-1)!;
    expect(resultadoHerramienta).toMatchObject({ rol: "herramienta", llamadaId: "llamada-buscar_documentos" });
    expect(resultadoHerramienta.contenido).toContain("Reglamento estudiantil – Evaluación y calificaciones");
  });

  it("una cita escrita con guion corto (-) también es válida", async () => {
    const modelo = new ModeloGuionado([
      pide("buscar_documentos", { consulta: NOTA_MINIMA }),
      dice("Es 3.0 [Reglamento estudiantil - Evaluación y calificaciones]"),
    ]);
    const resultado = await preguntar(modelo, "¿Nota mínima?");
    expect(resultado.reemplazada).toBe(false);
    expect(resultado.fuentes).toHaveLength(1);
  });
});

describe("Guardas contra alucinaciones (D5)", () => {
  it("Pregunta sin respuesta en los documentos: si el modelo inventa una respuesta, se reemplaza por 'no tengo esa información' con el contacto", async () => {
    const modelo = new ModeloGuionado([pide("buscar_documentos", { consulta: CAFETERIA }), dice("La cafetería abre a las 7:00 a. m.")]);

    const resultado = await preguntar(modelo, "¿A qué hora abre la cafetería?");

    expect(resultado.reemplazada).toBe(true);
    expect(resultado.respuesta).toContain("No tengo esa información");
    expect(resultado.respuesta).toContain(env.CONTACTO_FUNDACION);
    expect(resultado.respuesta).not.toContain("7:00");
    expect(resultado.fuentes).toEqual([]);
  });

  it("cita inválida: la respuesta se reemplaza (el error real de llama en la prueba de la tarea 3.2)", async () => {
    const modelo = new ModeloGuionado([
      pide("buscar_documentos", { consulta: NOTA_MINIMA }),
      dice("La nota mínima para aprobar un curso es 3.0 [Documento – Evaluación y calificaciones]."),
    ]);

    const resultado = await preguntar(modelo, "¿Nota mínima?");

    expect(resultado.reemplazada).toBe(true);
    expect(resultado.respuesta).toContain("No tengo esa información");
  });

  it("una sola cita inválida invalida la respuesta aunque otra sea válida", async () => {
    const modelo = new ModeloGuionado([
      pide("buscar_documentos", { consulta: NOTA_MINIMA }),
      dice("Es 3.0 [Reglamento estudiantil – Evaluación y calificaciones] y hay recuperación [Reglamento estudiantil – Recuperaciones]."),
    ]);
    expect((await preguntar(modelo, "¿Nota mínima?")).reemplazada).toBe(true);
  });

  it("buscó en los documentos pero respondió sin cita: se reemplaza", async () => {
    const modelo = new ModeloGuionado([pide("buscar_documentos", { consulta: NOTA_MINIMA }), dice("La nota mínima es 3.0.")]);
    expect((await preguntar(modelo, "¿Nota mínima?")).reemplazada).toBe(true);
  });

  it("sin herramientas y con una 'cita' inventada sin raya: se reemplaza (error real de gpt-oss en npm run dev, tarea 3.3)", async () => {
    const modelo = new ModeloGuionado([dice("La nota mínima para aprobar un curso es **4.0**. [Reglamento Académico]")]);

    const resultado = await preguntar(modelo, "¿Cuál es la nota mínima para aprobar un curso?");

    expect(resultado).toMatchObject({ reemplazada: true, pasos: 1, herramientas: [] });
    expect(resultado.respuesta).not.toContain("4.0");
  });

  it("sin herramientas no puede afirmar cifras (notas, fechas, valores): se reemplaza", async () => {
    const modelo = new ModeloGuionado([dice("La nota mínima es 4.0.")]);
    expect((await preguntar(modelo, "¿Nota mínima?")).reemplazada).toBe(true);
  });

  it("cada reemplazo dice su motivo (para los registros y la evaluación), y las citas inválidas que lo causaron", async () => {
    const casos: [ModeloGuionado, string, string[]?][] = [
      [new ModeloGuionado([dice("Es **4.0**. [Reglamento Académico]")]), "cita_invalida", ["Reglamento Académico"]],
      [new ModeloGuionado([dice("La nota mínima es 4.0.")]), "cifra_sin_fuente"],
      [new ModeloGuionado([pide("buscar_documentos", { consulta: NOTA_MINIMA }), dice("La nota mínima es 3.0.")]), "sin_cita"],
      [new ModeloGuionado([pide("buscar_documentos", { consulta: NOTA_MINIMA })]), "maximo_pasos"],
      [new ModeloGuionado([dice("")]), "sin_respuesta"],
    ];
    for (const [modelo, motivo, citasInvalidas] of casos) {
      const resultado = await preguntar(modelo, "¿Nota mínima?");
      expect(resultado.motivo).toBe(motivo);
      if (citasInvalidas) expect(resultado.citasInvalidas).toEqual(citasInvalidas);
    }
  });

  it("sin herramientas sí puede saludar o negarse, si no afirma cifras", async () => {
    const modelo = new ModeloGuionado([dice("Lo siento, solo puedo consultar tus propios datos.")]);
    const resultado = await preguntar(modelo, "Muéstrame las notas de Manuela");
    expect(resultado).toMatchObject({ respuesta: "Lo siento, solo puedo consultar tus propios datos.", reemplazada: false });
  });

  it("cualquier texto entre corchetes que no sea una fuente recuperada invalida la respuesta, aunque haya buscado", async () => {
    const modelo = new ModeloGuionado([pide("buscar_documentos", { consulta: NOTA_MINIMA }), dice("Es 3.0 [Reglamento estudiantil].")]);
    expect((await preguntar(modelo, "¿Nota mínima?")).reemplazada).toBe(true);
  });

  it("después de 4 pasos pidiendo herramientas, responde que no tiene la información", async () => {
    const modelo = new ModeloGuionado([pide("buscar_documentos", { consulta: NOTA_MINIMA })]);

    const resultado = await preguntar(modelo, "¿Nota mínima?");

    expect(MAXIMO_PASOS).toBe(4);
    expect(modelo.recibidos).toHaveLength(4);
    expect(resultado).toMatchObject({ pasos: 4, reemplazada: true });
    expect(resultado.respuesta).toContain("No tengo esa información");
  });
});

describe("Datos propios", () => {
  it("una respuesta solo con datos del estudiante no necesita cita", async () => {
    const modelo = new ModeloGuionado([pide("mi_estado_de_cuenta"), dice("Debes $ 180.000, de una cuota vencida.")]);

    const resultado = await preguntar(modelo, "¿Cuánto debo?");

    expect(resultado).toMatchObject({ respuesta: "Debes $ 180.000, de una cuota vencida.", reemplazada: false, fuentes: [] });
    expect(modelo.recibidos[1].at(-1)!.contenido).toContain("180000");
  });

  it("una herramienta desconocida devuelve un error al modelo y el ciclo continúa", async () => {
    const modelo = new ModeloGuionado([pide("borrar_mis_deudas"), pide("mi_estado_de_cuenta"), dice("Debes $ 180.000.")]);

    const resultado = await preguntar(modelo, "Borra mi deuda");

    expect(modelo.recibidos[1].at(-1)!.contenido).toContain("no existe");
    expect(resultado).toMatchObject({ respuesta: "Debes $ 180.000.", pasos: 3 });
  });
});

describe("Lo que recibe el modelo", () => {
  it("Revisión de lo enviado al modelo: las instrucciones presentan a Senda con el nombre de pila y la carrera, nunca con documento, correo, celular ni apellidos", async () => {
    const modelo = new ModeloGuionado([pide("mi_estado_de_cuenta"), dice("Debes $ 180.000.")]);
    await preguntar(modelo, "¿Cuánto debo?");

    const [sistema] = modelo.recibidos[0];
    expect(sistema.rol).toBe("sistema");
    expect(sistema.contenido).toContain(env.PRODUCTO_NOMBRE);
    expect(sistema.contenido).toContain(env.FUNDACION_NOMBRE);
    expect(sistema.contenido).toContain("Ana");
    expect(sistema.contenido).toContain("Técnico Laboral en Agentes");
    // Lección de la prueba real (tarea 3.3): siempre una herramienta antes de responder, y sin tablas en el celular
    expect(sistema.contenido).toMatch(/antes de responder/i);
    expect(sistema.contenido).toMatch(/no uses tablas/i);
    const todo = JSON.stringify(modelo.recibidos);
    for (const dato of [ANA.documento, `${ANA.documento}@correo.test`, ANA.celular, "Ríos", "María"]) expect(todo).not.toContain(dato);
  });

  // Estos tres escenarios dependen de que el modelo obedezca. Aquí se verifica lo que el código controla: la regla
  // está en las instrucciones y una negativa pasa la validación. Con el modelo real lo mide npm run eval:rag
  // (casos receta, resolver-taller y explicar-arreglo)
  it("Pregunta ajena / Pedir que resuelva el taller / Pedir que explique un tema de un curso: las instrucciones se lo prohíben al modelo y su negativa pasa la validación", async () => {
    const negativa = `Solo ayudo con temas de ${env.FUNDACION_NOMBRE}.`;
    const modelo = new ModeloGuionado([dice(negativa)]);

    const resultado = await preguntar(modelo, "Dame una receta de arroz con pollo");

    const [sistema] = modelo.recibidos[0];
    expect(sistema.contenido).toContain(`responde que solo ayudas con temas de ${env.FUNDACION_NOMBRE}`);
    expect(sistema.contenido).toContain("No resuelvas talleres ni evaluaciones, ni expliques temas de los cursos");
    expect(resultado).toMatchObject({ respuesta: negativa, reemplazada: false });
  });

  it("el historial guardado va antes de la pregunta nueva, en orden", async () => {
    const modelo = new ModeloGuionado([dice("La próxima vence el 5 de diciembre.")]);
    await preguntar(modelo, "¿Y cuándo vence la próxima?", {
      historial: [
        { rol: "usuario", contenido: "¿Cuánto debo?" },
        { rol: "asistente", contenido: "Debes $ 180.000." },
      ],
    });

    expect(modelo.recibidos[0].slice(1)).toEqual([
      { rol: "usuario", contenido: "¿Cuánto debo?" },
      { rol: "asistente", contenido: "Debes $ 180.000." },
      { rol: "usuario", contenido: "¿Y cuándo vence la próxima?" },
    ]);
  });

  it("si el modelo falla, el error ServicioIaNoDisponible llega a quien llamó (para responder 503, D11)", async () => {
    const modelo = new ModeloGuionado([new ServicioIaNoDisponible("sin cuota")]);
    await expect(preguntar(modelo, "¿Nota mínima?")).rejects.toBeInstanceOf(ServicioIaNoDisponible);
  });
});

// Tarea 4.1: el costo de una pregunta es la suma de todos sus pasos (cada paso envía otra vez todo el contexto)
describe("Tokens de cada pregunta", () => {
  const conUso = (respuesta: RespuestaModelo, entrada: number, salida: number): RespuestaModelo => ({ ...respuesta, uso: { entrada, salida } });

  it("suma los tokens de todos los pasos", async () => {
    const modelo = new ModeloGuionado([conUso(pide("mi_estado_de_cuenta"), 800, 40), conUso(dice("Debes $ 180.000."), 1500, 120)]);
    const resultado = await preguntar(modelo, "¿Cuánto debo?");
    expect(resultado).toMatchObject({ reemplazada: false, tokens: { entrada: 2300, salida: 160 } });
  });

  it("también cuenta los tokens cuando la respuesta se reemplaza: el modelo igual los gastó", async () => {
    const modelo = new ModeloGuionado([conUso(pide("buscar_documentos", { consulta: NOTA_MINIMA }), 700, 30), conUso(dice("La nota mínima es 3.0."), 1400, 50)]);
    const resultado = await preguntar(modelo, "¿Nota mínima?");
    expect(resultado).toMatchObject({ reemplazada: true, motivo: "sin_cita", tokens: { entrada: 2100, salida: 80 } });
  });

  it("un paso sin dato de tokens suma cero", async () => {
    const modelo = new ModeloGuionado([pide("mi_estado_de_cuenta"), conUso(dice("Debes $ 180.000."), 1500, 120)]);
    expect((await preguntar(modelo, "¿Cuánto debo?")).tokens).toEqual({ entrada: 1500, salida: 120 });
  });
});
