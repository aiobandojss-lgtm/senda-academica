// Regla de la trazabilidad entre las specs y las pruebas (npm run trazabilidad, scripts/trazabilidad.mjs).
// Son funciones puras para poder probarlas (scripts/regla-trazabilidad.test.ts). Node 24 ejecuta este archivo
// directamente quitando los tipos, como eval/calificar.ts: solo se usa sintaxis de tipos que se puede borrar.

export type Prueba = { linea: number; nombre: string };

/** Sin mayúsculas, tildes ni signos: "Sesión vencida" y "sesion vencida" son el mismo nombre. */
export const normalizar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Escenarios que declara el nombre de una prueba: lo que va antes de los primeros dos puntos (o el nombre completo
 * si no los tiene), separado por " / ". "Escenario A / Escenario B: detalle" declara A y B.
 */
export const escenariosDeclarados = (nombrePrueba: string): string[] => {
  const dosPuntos = nombrePrueba.indexOf(":");
  const declaracion = dosPuntos === -1 ? nombrePrueba : nombrePrueba.slice(0, dosPuntos);
  return declaracion.split(" / ").map(normalizar).filter(Boolean);
};

/**
 * La prueba cubre el escenario solo si lo declara con su nombre exacto. No basta con que el nombre lo contenga:
 * "un docente tampoco puede retirar documentos" no verifica el escenario "Retirar documento".
 */
export const cubre = (nombrePrueba: string, escenario: string): boolean =>
  escenariosDeclarados(nombrePrueba).includes(normalizar(escenario));

// it("..."), test("...") y test.step("..."), pero no it.skip(...) ni una expresión regular como /x/.test("...")
const LLAMADA_DE_PRUEBA = /(?<![.\w$])(?:it|test|test\.step)\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
// describe.skip, it.only, test.describe.skip...: un grupo saltado escondería pruebas que sí se cuentan
const SALTO = /(?<![.\w$])(?:describe|it|test)(?:\.describe)?\.(?:skip|only)\b/;
// Una línea comentada con // o dentro de un bloque /* ... */ que empieza con *
const COMENTADA = /^\s*(?:\/\/|\*)/;

const lineaDe = (texto: string, indice: number): number => texto.slice(0, indice).split("\n").length;

export const pruebasDelTexto = (texto: string): Prueba[] => {
  const pruebas: Prueba[] = [];
  for (const m of texto.matchAll(LLAMADA_DE_PRUEBA)) {
    const inicioDeLinea = texto.lastIndexOf("\n", m.index) + 1;
    if (COMENTADA.test(texto.slice(inicioDeLinea, m.index))) continue;
    pruebas.push({ linea: lineaDe(texto, m.index), nombre: m[2] });
  }
  return pruebas;
};

/** Líneas con un .skip o un .only activo: la trazabilidad no acepta pruebas que no corren. */
export const saltadasDelTexto = (texto: string): number[] =>
  texto
    .split("\n")
    .flatMap((linea, i) => (SALTO.test(linea) && !COMENTADA.test(linea) ? [i + 1] : []));
