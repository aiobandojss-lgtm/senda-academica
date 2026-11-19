import { describe, expect, it } from "vitest";
import { analizarRespuesta, type FuenteAsistente } from "../src/lib/respuesta-asistente";

// Tarea RAG 3.4: la pantalla del asistente convierte la respuesta del modelo en bloques que React dibuja como texto.
// Entiende solo lo que piden las instrucciones del sistema (frases cortas, listas, negritas y citas entre corchetes)
// y nunca produce HTML: un "<script>" en la respuesta se queda como texto.

const REGLAMENTO: FuenteAsistente = { documento: "Reglamento estudiantil", seccion: "Entregas de talleres" };
const CALENDARIO: FuenteAsistente = { documento: "Calendario académico", seccion: "Fechas del semestre" };

describe("analizarRespuesta", () => {
  it("separa párrafos por líneas en blanco y conserva los saltos de línea de un párrafo", () => {
    expect(analizarRespuesta("Hola, Paola.\nTe ayudo.\n\nOtra idea.", [])).toEqual([
      { tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Hola, Paola." }], [{ tipo: "texto", texto: "Te ayudo." }]] },
      { tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Otra idea." }]] },
    ]);
  });

  it("reconoce negritas", () => {
    expect(analizarRespuesta("Debes **$ 360.000** en total.", [])).toEqual([
      {
        tipo: "parrafo",
        lineas: [
          [
            { tipo: "texto", texto: "Debes " },
            { tipo: "negrita", texto: "$ 360.000" },
            { tipo: "texto", texto: " en total." },
          ],
        ],
      },
    ]);
  });

  it("arma listas con viñetas (-, * o •) y listas numeradas", () => {
    expect(analizarRespuesta("Tienes pendiente:\n- Taller 3\n* Taller 4\n• Evaluación final\n\n1. Primero\n2) Segundo", [])).toEqual([
      { tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Tienes pendiente:" }]] },
      {
        tipo: "lista",
        ordenada: false,
        items: [[{ tipo: "texto", texto: "Taller 3" }], [{ tipo: "texto", texto: "Taller 4" }], [{ tipo: "texto", texto: "Evaluación final" }]],
      },
      { tipo: "lista", ordenada: true, items: [[{ tipo: "texto", texto: "Primero" }], [{ tipo: "texto", texto: "Segundo" }]] },
    ]);
  });

  it("una lista justo después de un párrafo, sin línea en blanco, también es lista", () => {
    const [, lista] = analizarRespuesta("Pendientes:\n- Taller 3", []);
    expect(lista).toEqual({ tipo: "lista", ordenada: false, items: [[{ tipo: "texto", texto: "Taller 3" }]] });
  });

  it("cambia cada cita por el número de su fuente, en el orden de la lista de fuentes", () => {
    const bloques = analizarRespuesta("Las fechas están en el calendario [Calendario académico – Fechas del semestre]. Si entregas tarde, queda tardía [Reglamento estudiantil – Entregas de talleres].", [
      CALENDARIO,
      REGLAMENTO,
    ]);
    expect(bloques).toEqual([
      {
        tipo: "parrafo",
        lineas: [
          [
            // El espacio antes de la cita se quita: el número queda pegado a la palabra
            { tipo: "texto", texto: "Las fechas están en el calendario" },
            { tipo: "cita", numero: 1, fuente: CALENDARIO },
            { tipo: "texto", texto: ". Si entregas tarde, queda tardía" },
            { tipo: "cita", numero: 2, fuente: REGLAMENTO },
            { tipo: "texto", texto: "." },
          ],
        ],
      },
    ]);
  });

  it("compara las citas sin importar mayúsculas, el tipo de raya ni los espacios, como la validación del servidor", () => {
    const [bloque] = analizarRespuesta("Queda tardía [reglamento estudiantil -  Entregas de talleres.]", [REGLAMENTO]);
    expect(bloque).toEqual({
      tipo: "parrafo",
      lineas: [[{ tipo: "texto", texto: "Queda tardía" }, { tipo: "cita", numero: 1, fuente: REGLAMENTO }]],
    });
  });

  it("un texto entre corchetes que no es una fuente se queda como texto", () => {
    const [bloque] = analizarRespuesta("Escribe [tu nombre] aquí.", [REGLAMENTO]);
    expect(bloque).toEqual({ tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Escribe [tu nombre] aquí." }]] });
  });

  it("un enlace de Markdown se muestra solo como texto, sin el enlace", () => {
    const [bloque] = analizarRespuesta("Mira [la página](https://ejemplo.com/pagar).", []);
    expect(bloque).toEqual({ tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Mira la página." }]] });
  });

  it("los títulos con # se muestran como un párrafo en negrita y las líneas --- se omiten", () => {
    expect(analizarRespuesta("## Tus notas\n---\nVan bien.", [])).toEqual([
      { tipo: "parrafo", lineas: [[{ tipo: "negrita", texto: "Tus notas" }], [{ tipo: "texto", texto: "Van bien." }]] },
    ]);
  });

  it("nunca interpreta HTML: las etiquetas quedan como texto literal", () => {
    const [bloque] = analizarRespuesta("<script>alert(1)</script>", []);
    expect(bloque).toEqual({ tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "<script>alert(1)</script>" }]] });
  });

  it("acepta finales de línea de Windows y quita líneas en blanco del inicio y del final", () => {
    expect(analizarRespuesta("\r\nHola.\r\n\r\n", [])).toEqual([{ tipo: "parrafo", lineas: [[{ tipo: "texto", texto: "Hola." }]] }]);
  });
});
