import { describe, expect, it } from "vitest";
import { calificar, normalizar, resumir, type CasoEvaluacion } from "./calificar.ts";

// Tarea RAG 4.1: calificador de la evaluación del asistente (RAG design.md D7). Compara cada respuesta real con
// lo esperado en eval/preguntas.json usando reglas fijas, sin otro modelo como juez: el mismo resultado en cada
// corrida, sin gastar cuota y fácil de explicar. Si el calificador se equivoca, el porcentaje de la demo miente:
// por eso tiene pruebas.

const REGLAMENTO_EVALUACION = { documento: "Reglamento estudiantil", seccion: "Evaluación y calificaciones" };
const PLAN_CONTABLE = { documento: "Plan de estudios – Técnico Laboral en Auxiliar Contable y Financiero", seccion: "Semestre 1" };
const NO_SE = "No tengo esa información. Te sugiero consultarlo con la coordinación administrativa de la Fundación.";

const caso = (extra: Partial<CasoEvaluacion>): CasoEvaluacion => ({ id: "prueba", categoria: "documentos", pregunta: "¿?", ...extra });

describe("normalizar", () => {
  it("quita mayúsculas, tildes y los asteriscos de las negritas", () => {
    expect(normalizar("La **Nota Mínima** es 3.0")).toBe("la nota minima es 3.0");
  });

  it("escribe igual los valores con punto, espacio o espacio duro como separador de miles", () => {
    for (const valor of ["$360.000", "$ 360 000", "$360\u00a0000", "$360\u202f000", "$360,000"]) expect(normalizar(valor)).toContain("360000");
    expect(normalizar("1.000.000")).toBe("1000000");
  });

  it("acepta la coma decimal como punto, sin tocar las comas entre palabras ni entre números de una lista", () => {
    expect(normalizar("Tu nota es 3,9, la otra 4,5")).toBe("tu nota es 3.9, la otra 4.5");
  });

  it("unifica las rayas y los espacios", () => {
    expect(normalizar("Reglamento   estudiantil — Entregas")).toBe("reglamento estudiantil - entregas");
  });
});

describe("calificar", () => {
  it("acierta si la respuesta trae todo lo esperado y la fuente esperada", () => {
    const resultado = calificar(caso({ contiene: ["3.0"], fuente: "Reglamento estudiantil – Evaluación y calificaciones" }), {
      respuesta: "La nota mínima para aprobar un curso es **3,0** [Reglamento estudiantil – Evaluación y calificaciones].",
      fuentes: [REGLAMENTO_EVALUACION],
    });
    expect(resultado).toEqual({ acierto: true, fallas: [], citaCorrecta: true });
  });

  it("falla si falta un texto esperado, y dice cuál", () => {
    const resultado = calificar(caso({ categoria: "datos_propios", contiene: ["360.000"] }), { respuesta: "Debes $180.000.", fuentes: [] });
    expect(resultado.acierto).toBe(false);
    expect(resultado.fallas).toEqual(['falta "360.000"']);
  });

  it("una lista de alternativas se cumple con cualquiera de ellas", () => {
    const esperado = caso({ categoria: "datos_propios", contiene: [["23 de noviembre", "2026-11-23", "23/11"]] });
    expect(calificar(esperado, { respuesta: "Vence el 2026-11-23 a las 23:59.", fuentes: [] }).acierto).toBe(true);
    expect(calificar(esperado, { respuesta: "Vence el 24 de noviembre.", fuentes: [] }).fallas).toEqual(['falta "23 de noviembre" o "2026-11-23" o "23/11"']);
  });

  it("falla si la respuesta dice algo prohibido", () => {
    const resultado = calificar(caso({ categoria: "datos_propios", noContiene: ["Taller 4"] }), { respuesta: "Tienes pendiente el **Taller 4**.", fuentes: [] });
    expect(resultado).toMatchObject({ acierto: false, fallas: ['no debía decir "Taller 4"'] });
  });

  it("falla sin la fuente esperada: la cita no es correcta aunque el dato lo sea", () => {
    const resultado = calificar(caso({ contiene: ["3.0"], fuente: "Reglamento estudiantil – Evaluación y calificaciones" }), {
      respuesta: "La nota mínima es 3.0 [Preguntas frecuentes – ¿Dónde veo mis notas?].",
      fuentes: [{ documento: "Preguntas frecuentes", seccion: "¿Dónde veo mis notas?" }],
    });
    expect(resultado).toEqual({ acierto: false, fallas: ['sin la fuente "Reglamento estudiantil – Evaluación y calificaciones"'], citaCorrecta: false });
  });

  it("la fuente se compara sin importar mayúsculas ni el tipo de raya, y puede tener alternativas", () => {
    const esperado = caso({ fuente: ["Preguntas frecuentes – ¿Cómo entrego un taller?", "REGLAMENTO ESTUDIANTIL - EVALUACIÓN Y CALIFICACIONES"] });
    expect(calificar(esperado, { respuesta: "PDF o Word.", fuentes: [REGLAMENTO_EVALUACION] }).citaCorrecta).toBe(true);
  });

  it("un caso sin fuente esperada no cuenta para las citas", () => {
    expect(calificar(caso({ categoria: "datos_propios" }), { respuesta: "Debes $360.000.", fuentes: [] })).not.toHaveProperty("citaCorrecta");
  });

  it("falla si usó un documento prohibido, como el plan de estudios de otra carrera", () => {
    const resultado = calificar(caso({ categoria: "fuera_de_dominio", documentoProhibido: PLAN_CONTABLE.documento }), {
      respuesta: "Ves Fundamentos de contabilidad.",
      fuentes: [PLAN_CONTABLE],
    });
    expect(resultado.fallas).toEqual([`usó el documento prohibido "${PLAN_CONTABLE.documento}"`]);
  });

  it('niega: acierta solo si responde "no tengo esa información"', () => {
    const esperado = caso({ categoria: "sin_respuesta", niega: true });
    expect(calificar(esperado, { respuesta: NO_SE, fuentes: [] }).acierto).toBe(true);
    expect(calificar(esperado, { respuesta: "La cafetería abre a las 7:00 a. m.", fuentes: [] }).fallas).toEqual(['no dijo "no tengo esa información"']);
  });

  it("rechaza: acepta las formas de negarse que piden las instrucciones del asistente", () => {
    const esperado = caso({ categoria: "fuera_de_dominio", rechaza: true });
    for (const respuesta of [
      "Lo siento, solo puedo ayudarte con temas de la Fundación (demo).",
      "Solo puedo consultar tus propios datos.",
      "No puedo resolver el taller por ti, pero puedo contarte cómo se entrega.",
      NO_SE,
    ]) {
      expect(calificar(esperado, { respuesta, fuentes: [] }).acierto).toBe(true);
    }
    expect(calificar(esperado, { respuesta: "Claro: necesitas arroz, pollo y cebolla.", fuentes: [] }).fallas).toEqual(["no se negó"]);
  });

  it("negarse a una pregunta que sí tiene respuesta es una falla, con un mensaje claro", () => {
    const resultado = calificar(caso({ contiene: ["3.0"] }), { respuesta: NO_SE, fuentes: [] });
    expect(resultado.acierto).toBe(false);
    expect(resultado.fallas[0]).toBe("se negó, y la pregunta sí tiene respuesta");
  });
});

describe("resumir", () => {
  it("cuenta los aciertos por categoría, el porcentaje, las citas correctas y las negaciones correctas", () => {
    const resultados = [
      { caso: caso({ id: "a", fuente: "x" }), calificacion: { acierto: true, fallas: [], citaCorrecta: true } },
      { caso: caso({ id: "b", fuente: "x" }), calificacion: { acierto: false, fallas: ["sin la fuente"], citaCorrecta: false } },
      { caso: caso({ id: "c", categoria: "datos_propios" }), calificacion: { acierto: true, fallas: [] } },
      { caso: caso({ id: "d", categoria: "sin_respuesta", niega: true }), calificacion: { acierto: true, fallas: [] } },
      { caso: caso({ id: "e", categoria: "fuera_de_dominio", rechaza: true }), calificacion: { acierto: false, fallas: ["no se negó"] } },
      { caso: caso({ id: "f", categoria: "fuera_de_dominio" }), calificacion: { acierto: true, fallas: [] } },
    ];

    expect(resumir(resultados)).toEqual({
      total: 6,
      aciertos: 4,
      porcentaje: 66.7,
      porCategoria: {
        documentos: { total: 2, aciertos: 1 },
        datos_propios: { total: 1, aciertos: 1 },
        sin_respuesta: { total: 1, aciertos: 1 },
        fuera_de_dominio: { total: 2, aciertos: 1 },
      },
      citas: { total: 2, correctas: 1 },
      negaciones: { total: 2, correctas: 1 },
    });
  });
});
