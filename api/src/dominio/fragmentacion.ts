// Fragmentación de los documentos del asistente por secciones (spec `base-conocimiento`, design.md D3).
// Función pura: recibe el Markdown y devuelve los fragmentos con la sección de donde vienen, que es lo que el
// asistente cita como "[Documento – Sección]". Alternativa descartada: fragmentos de tamaño fijo, que parten una
// regla por la mitad y pierden la sección.

export type FragmentoTexto = { orden: number; seccion: string; contenido: string };
export type OpcionesFragmentacion = { maximo?: number; solapamiento?: number };

// Tamaños en caracteres (D3). Una sección más larga se parte por párrafos, y cada parte empieza con el final de
// la anterior (solapamiento): así una regla que quede justo en el corte no pierde su contexto.
export const MAXIMO_FRAGMENTO = 1200;
export const SOLAPAMIENTO_FRAGMENTO = 150;

// El texto antes del primer título ## (bajo el título # del documento) va en esta sección
const SECCION_INICIAL = "Introducción";
const SEPARADOR_RUTA = " > ";
const BOM = 0xfeff;

export function fragmentarDocumento(markdown: string, opciones: OpcionesFragmentacion = {}): FragmentoTexto[] {
  const maximo = opciones.maximo ?? MAXIMO_FRAGMENTO;
  const solapamiento = opciones.solapamiento ?? SOLAPAMIENTO_FRAGMENTO;
  // Cada parte = solapamiento + "\n\n" + un párrafo; el párrafo debe poder ser más largo que el solapamiento
  if (solapamiento < 0 || maximo <= 2 * solapamiento + 2) {
    throw new Error("El máximo de un fragmento debe ser mayor que dos veces el solapamiento");
  }

  const fragmentos: FragmentoTexto[] = [];
  for (const { ruta, cuerpo } of leerSecciones(markdown)) {
    const partes = cuerpo.length <= maximo ? [cuerpo] : partirSeccion(cuerpo, maximo, solapamiento);
    for (const contenido of partes) fragmentos.push({ orden: fragmentos.length, seccion: ruta, contenido });
  }
  return fragmentos;
}

// Divide el documento por títulos #, ## y ###. El # es el título del documento (no entra en la ruta), los ## son
// las secciones y los ### quedan como "Sección > Subsección". Un #### o más es parte del texto.
function leerSecciones(markdown: string): { ruta: string; cuerpo: string }[] {
  const lineas = quitarFrontMatter(normalizar(markdown)).split("\n");
  const secciones: { ruta: string; lineas: string[] }[] = [];
  let actual = { ruta: SECCION_INICIAL, lineas: [] as string[] };
  // Último título ## visto: un ### se cita debajo de él
  let titulo2: string | null = null;

  for (const linea of lineas) {
    const titulo = /^(#{1,3})[ \t]+(.+?)[ \t]*$/.exec(linea);
    if (!titulo) {
      actual.lineas.push(linea);
      continue;
    }
    secciones.push(actual);
    const nivel = titulo[1].length;
    // Markdown permite cerrar el título con almohadillas: "## Becas ##"
    const texto = titulo[2].replace(/[ \t]+#+$/, "");
    let ruta: string;
    if (nivel === 1) {
      titulo2 = null;
      ruta = SECCION_INICIAL;
    } else if (nivel === 2) {
      titulo2 = texto;
      ruta = texto;
    } else {
      ruta = titulo2 === null ? texto : `${titulo2}${SEPARADOR_RUTA}${texto}`;
    }
    actual = { ruta, lineas: [] };
  }
  secciones.push(actual);

  return secciones
    .map(({ ruta, lineas }) => ({ ruta, cuerpo: lineas.join("\n").trim() }))
    .filter(({ cuerpo }) => cuerpo.length > 0);
}

// Finales de línea de Windows y marca BOM: los documentos pueden venir de cualquier editor
function normalizar(texto: string): string {
  const sinBom = texto.charCodeAt(0) === BOM ? texto.slice(1) : texto;
  return sinBom.replace(/\r\n?/g, "\n");
}

// Encabezado de metadatos (front matter) entre dos líneas "---" al inicio del archivo, como en docs/rag
function quitarFrontMatter(texto: string): string {
  const encabezado = /^---\n[\s\S]*?\n---[ \t]*(?:\n|$)/.exec(texto);
  return encabezado ? texto.slice(encabezado[0].length) : texto;
}

// Parte una sección larga por párrafos, sin pasar el máximo. Cada parte después de la primera empieza con las
// últimas palabras de la anterior (hasta `solapamiento` caracteres).
function partirSeccion(cuerpo: string, maximo: number, solapamiento: number): string[] {
  // Con este límite, solapamiento + "\n\n" + párrafo nunca pasa el máximo
  const limiteParrafo = maximo - solapamiento - 2;
  const parrafos = cuerpo
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .flatMap((p) => (p.length <= limiteParrafo ? [p] : partirParrafo(p, limiteParrafo)));

  const partes: string[] = [];
  let actual = "";
  for (const parrafo of parrafos) {
    const candidato = actual ? `${actual}\n\n${parrafo}` : parrafo;
    if (candidato.length <= maximo) {
      actual = candidato;
      continue;
    }
    partes.push(actual);
    const solape = ultimasPalabras(actual, solapamiento);
    actual = solape ? `${solape}\n\n${parrafo}` : parrafo;
  }
  if (actual) partes.push(actual);
  return partes;
}

// Un párrafo que no cabe se parte primero por líneas (así una lista conserva sus renglones) y, si una línea
// sola no cabe, entre palabras
function partirParrafo(parrafo: string, limite: number): string[] {
  const lineas = parrafo.split("\n").flatMap((l) => (l.length <= limite ? [l] : partirEntrePalabras(l, limite)));
  return agrupar(lineas, "\n", limite);
}

function partirEntrePalabras(texto: string, limite: number): string[] {
  const palabras = texto
    .split(/\s+/)
    .filter((p) => p.length > 0)
    // Una "palabra" más larga que el límite (por ejemplo, una URL) es el único caso en que se corta
    .flatMap((p) => (p.length <= limite ? [p] : (p.match(new RegExp(`[\\s\\S]{1,${limite}}`, "g")) ?? [])));
  return agrupar(palabras, " ", limite);
}

// Junta piezas consecutivas mientras quepan en el límite
function agrupar(piezas: string[], union: string, limite: number): string[] {
  const grupos: string[] = [];
  let actual = "";
  for (const pieza of piezas) {
    const candidato = actual ? `${actual}${union}${pieza}` : pieza;
    if (candidato.length <= limite) {
      actual = candidato;
    } else {
      if (actual) grupos.push(actual);
      actual = pieza;
    }
  }
  if (actual) grupos.push(actual);
  return grupos;
}

// El final de un texto, de hasta `maximo` caracteres, empezando en una palabra completa
function ultimasPalabras(texto: string, maximo: number): string {
  if (maximo === 0) return "";
  if (texto.length <= maximo) return texto;
  let cola = texto.slice(-maximo);
  // Si la cola empieza a mitad de una palabra, se salta hasta el siguiente espacio
  if (!/\s/.test(texto[texto.length - maximo - 1])) {
    const espacio = cola.search(/\s/);
    cola = espacio === -1 ? "" : cola.slice(espacio);
  }
  return cola.trimStart();
}
