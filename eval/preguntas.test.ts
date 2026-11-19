import { describe, expect, it } from "vitest";
import { LIMITE_DIARIO } from "../api/src/rutas/asistente";
import type { CasoEvaluacion, Categoria } from "./calificar.ts";
import evaluacion from "./preguntas.json";

// Tarea RAG 4.1: el archivo de casos de la evaluación se revisa aquí, sin gastar cuota. Un caso mal escrito (sin
// reglas, con un id repetido o una categoría que no existe) se descubriría tarde, ya corriendo contra el modelo real.

const casos = evaluacion.casos as CasoEvaluacion[];
const CATEGORIAS: Categoria[] = ["documentos", "datos_propios", "sin_respuesta", "fuera_de_dominio"];

describe("eval/preguntas.json", () => {
  it("cada caso tiene un id único, una categoría válida, una pregunta y al menos una regla para calificarlo", () => {
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
    for (const caso of casos) {
      expect(CATEGORIAS, caso.id).toContain(caso.categoria);
      expect(caso.pregunta.trim(), caso.id).not.toBe("");
      const reglas = [caso.contiene?.length, caso.noContiene?.length, caso.fuente, caso.documentoProhibido, caso.niega, caso.rechaza];
      expect(reglas.some(Boolean), `${caso.id} no tiene reglas`).toBe(true);
    }
  });

  it("cubre las cuatro categorías de la evaluación (design.md D7) con unos 25 casos", () => {
    for (const categoria of CATEGORIAS) expect(casos.some((c) => c.categoria === categoria), categoria).toBe(true);
    expect(casos.length).toBeGreaterThanOrEqual(20);
  });

  it("las preguntas sobre documentos esperan una fuente: así se mide si las citas son correctas", () => {
    for (const caso of casos.filter((c) => c.categoria === "documentos")) expect(caso.fuente, caso.id).toBeDefined();
  });

  it("la evaluación completa cabe en el límite diario de una estudiante (cada pregunta previa también cuenta)", () => {
    const preguntas = casos.reduce((total, c) => total + 1 + (c.previas?.length ?? 0), 0);
    expect(preguntas).toBeLessThanOrEqual(LIMITE_DIARIO);
  });
});
