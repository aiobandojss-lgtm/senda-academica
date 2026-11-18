import { describe, expect, it } from "vitest";
import { fragmentarDocumento } from "../src/dominio/fragmentacion";
import reglamento from "../../docs/rag/reglamento-estudiantil.md?raw";

// Tarea RAG 2.1: fragmentación por secciones (spec `base-conocimiento`, "Indexación en fragmentos"; design.md D3).
// Cada fragmento conserva la sección de donde viene, para que el asistente cite "[Documento – Sección]".

const secciones = (texto: string, opciones?: Parameters<typeof fragmentarDocumento>[1]) =>
  fragmentarDocumento(texto, opciones).map((f) => f.seccion);

describe("fragmentarDocumento: secciones", () => {
  it("parte por títulos ## y conserva el título de cada sección", () => {
    const texto = "# Reglamento\n\n## Matrícula\n\nSe paga una vez.\n\n## Entregas de talleres\n\nSe entregan en PDF.";
    expect(fragmentarDocumento(texto)).toEqual([
      { orden: 0, seccion: "Matrícula", contenido: "Se paga una vez." },
      { orden: 1, seccion: "Entregas de talleres", contenido: "Se entregan en PDF." },
    ]);
  });

  it("el texto antes de la primera sección queda en 'Introducción' y el título # no se repite en el contenido", () => {
    const [primero] = fragmentarDocumento("# Reglamento\n\nTexto inicial.\n\n## Objeto\n\nNormas.");
    expect(primero).toEqual({ orden: 0, seccion: "Introducción", contenido: "Texto inicial." });
  });

  it("los títulos ### quedan como ruta bajo su sección ##, y la ruta se reinicia con la siguiente ##", () => {
    const texto = "## Evaluación\n\nIntro.\n\n### Talleres\n\nSesenta.\n\n### Parcial\n\nCuarenta.\n\n## Becas\n\nHay becas.";
    expect(secciones(texto)).toEqual(["Evaluación", "Evaluación > Talleres", "Evaluación > Parcial", "Becas"]);
  });

  it("omite las secciones vacías y numera los fragmentos sin huecos", () => {
    const fragmentos = fragmentarDocumento("## Vacía\n\n## Llena\n\nTexto.\n\n## Otra vacía\n");
    expect(fragmentos).toEqual([{ orden: 0, seccion: "Llena", contenido: "Texto." }]);
  });

  it("un título #### no parte el texto: queda dentro de su sección", () => {
    const [unico] = fragmentarDocumento("## Pagos\n\n#### Detalle\n\nCuotas mensuales.");
    expect(unico.seccion).toBe("Pagos");
    expect(unico.contenido).toBe("#### Detalle\n\nCuotas mensuales.");
  });

  it("conserva las listas dentro de la sección", () => {
    const [unico] = fragmentarDocumento("## Nota final\n\n- Talleres: 60 %.\n- Evaluación parcial: 40 %.");
    expect(unico.contenido).toBe("- Talleres: 60 %.\n- Evaluación parcial: 40 %.");
  });

  it("ignora el encabezado de metadatos (front matter) al inicio del archivo", () => {
    const texto = "---\ntitulo: Reglamento\ntipo: reglamento\n---\n\n# Reglamento\n\n## Objeto\n\nNormas.";
    expect(fragmentarDocumento(texto)).toEqual([{ orden: 0, seccion: "Objeto", contenido: "Normas." }]);
  });

  it("ignora la marca BOM con la que algunos editores de Windows guardan el UTF-8", () => {
    const bom = String.fromCharCode(0xfeff);
    const texto = `${bom}---\ntitulo: Reglamento\n---\n\n## Objeto\n\nNormas.`;
    expect(fragmentarDocumento(texto)).toEqual([{ orden: 0, seccion: "Objeto", contenido: "Normas." }]);
  });

  it("acepta finales de línea de Windows (CRLF) sin dejar \\r en el texto", () => {
    const fragmentos = fragmentarDocumento("## Objeto\r\n\r\nNormas.\r\n\r\nMás normas.\r\n");
    expect(fragmentos).toEqual([{ orden: 0, seccion: "Objeto", contenido: "Normas.\n\nMás normas." }]);
  });
});

describe("fragmentarDocumento: tamaño máximo", () => {
  // Párrafos de ~110 caracteres con palabras normales, distinguibles entre sí por su número
  const parrafo = (n: number) => `Párrafo ${String(n).padStart(2, "0")} ${"texto de ejemplo ".repeat(6).trim()}.`;
  const seccionLarga = "## Larga\n\n" + Array.from({ length: 12 }, (_, i) => parrafo(i)).join("\n\n");
  const opciones = { maximo: 400, solapamiento: 60 };

  it("una sección más larga que el máximo se parte por párrafos y ningún fragmento supera el máximo", () => {
    const fragmentos = fragmentarDocumento(seccionLarga, opciones);
    expect(fragmentos.length).toBeGreaterThan(1);
    for (const f of fragmentos) {
      expect(f.seccion).toBe("Larga");
      expect(f.contenido.length).toBeLessThanOrEqual(opciones.maximo);
    }
  });

  it("no se pierde ningún párrafo al partir", () => {
    const todo = fragmentarDocumento(seccionLarga, opciones)
      .map((f) => f.contenido)
      .join("\n");
    for (let i = 0; i < 12; i++) expect(todo).toContain(parrafo(i));
  });

  it("cada fragmento empieza con el final del anterior (solapamiento), cortado en una palabra completa", () => {
    const fragmentos = fragmentarDocumento(seccionLarga, opciones);
    for (let i = 1; i < fragmentos.length; i++) {
      const anterior = fragmentos[i - 1].contenido;
      const [solape] = fragmentos[i].contenido.split("\n\n");
      expect(solape.length).toBeGreaterThan(0);
      expect(solape.length).toBeLessThanOrEqual(opciones.solapamiento);
      expect(anterior.endsWith(solape)).toBe(true);
    }
  });

  it("un párrafo más largo que el máximo se parte entre palabras, sin cortar ninguna", () => {
    const palabras = Array.from({ length: 150 }, (_, i) => `palabra${i}`);
    const fragmentos = fragmentarDocumento("## Un solo párrafo\n\n" + palabras.join(" "), opciones);
    expect(fragmentos.length).toBeGreaterThan(1);
    const vistas = new Set<string>();
    for (const f of fragmentos) {
      expect(f.contenido.length).toBeLessThanOrEqual(opciones.maximo);
      for (const palabra of f.contenido.split(/\s+/)) {
        expect(palabra).toMatch(/^palabra\d+$/);
        vistas.add(palabra);
      }
    }
    expect(vistas.size).toBe(150);
  });

  it("una sección que cabe en el máximo queda en un solo fragmento", () => {
    expect(fragmentarDocumento("## Corta\n\n" + parrafo(1), opciones)).toHaveLength(1);
  });
});

describe("fragmentarDocumento con el reglamento real (docs/rag)", () => {
  const fragmentos = fragmentarDocumento(reglamento);

  it("produce la sección 'Entregas de talleres' con la regla de las entregas tardías", () => {
    const entregas = fragmentos.find((f) => f.seccion === "Entregas de talleres");
    expect(entregas?.contenido).toContain("descuento de 0.5");
  });

  it("produce una sección por cada título ## y ningún fragmento supera 1.200 caracteres", () => {
    const titulos = [...reglamento.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    expect(titulos.length).toBeGreaterThan(5);
    for (const titulo of titulos) expect(fragmentos.some((f) => f.seccion === titulo)).toBe(true);
    for (const f of fragmentos) expect(f.contenido.length).toBeLessThanOrEqual(1200);
  });
});
