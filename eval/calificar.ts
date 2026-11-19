// Calificador de la evaluación del asistente Senda (tarea RAG 4.1; RAG design.md D7).
//
// Compara cada respuesta real del asistente con lo esperado en eval/preguntas.json usando reglas fijas: textos que
// debe y no debe decir, la fuente que debe citar y si debe negarse. No usa otro modelo como juez: así el resultado
// no cambia entre corridas, no gasta cuota y cada falla se explica en una línea.
//
// Lo usan scripts/eval-rag.mjs (Node lo ejecuta directo, sin compilar: por eso solo usa sintaxis de TypeScript que
// Node sabe quitar, sin enum ni namespace) y sus pruebas en eval/calificar.test.ts.

export type Categoria = "documentos" | "datos_propios" | "sin_respuesta" | "fuera_de_dominio";

// Un texto, o varias formas válidas de escribirlo (basta una)
export type Alternativas = string | string[];

export type CasoEvaluacion = {
  id: string;
  categoria: Categoria;
  pregunta: string;
  // Preguntas anteriores de la misma conversación, para probar el historial (D8)
  previas?: string[];
  // Cada elemento debe aparecer en la respuesta
  contiene?: Alternativas[];
  // Ninguno debe aparecer
  noContiene?: string[];
  // "Documento – Sección" que debe estar entre las fuentes de la respuesta
  fuente?: Alternativas;
  // Título de un documento que nunca debe aparecer entre las fuentes (por ejemplo, el plan de otra carrera)
  documentoProhibido?: string;
  // Debe responder "no tengo esa información"
  niega?: boolean;
  // Debe negarse: tema ajeno, datos de otra persona o resolver una actividad
  rechaza?: boolean;
};

export type Fuente = { documento: string; seccion: string };
export type RespuestaAsistente = { respuesta: string; fuentes: Fuente[] };
// citaCorrecta solo existe si el caso espera una fuente
export type Calificacion = { acierto: boolean; fallas: string[]; citaCorrecta?: boolean };
export type Resultado = { caso: CasoEvaluacion; calificacion: Calificacion };

// Texto comparable: sin mayúsculas, tildes ni negritas, con una sola forma de escribir los miles ($360.000,
// $ 360 000 y 360000 quedan iguales) y los decimales (3,0 queda 3.0)
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/(\d)[.\s,](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

// La respuesta de "no tengo esa información" (spec: reconocer cuando no sabe)
const NEGACION = /no tengo (esa |la )?informacion/;
// Las formas de negarse que piden las instrucciones del asistente (api/src/rag/agente.ts, reglas 5 a 7)
const RECHAZO = /\b(solo|unicamente)\b[^.]{0,60}\b(ayud|consult|respond|atiend|apoy|temas|datos|informacion)|\bno (puedo|me es posible|es posible|esta permitido)\b/;

const lista = (alternativas: Alternativas) => (Array.isArray(alternativas) ? alternativas : [alternativas]);
const citaDe = (fuente: Fuente) => `${fuente.documento} – ${fuente.seccion}`;

export function calificar(caso: CasoEvaluacion, { respuesta, fuentes }: RespuestaAsistente): Calificacion {
  const texto = normalizar(respuesta);
  const fallas: string[] = [];
  const seNego = NEGACION.test(texto);

  // Una negativa a una pregunta que sí tiene respuesta: el mensaje más claro va primero
  if (seNego && (caso.categoria === "documentos" || caso.categoria === "datos_propios")) fallas.push("se negó, y la pregunta sí tiene respuesta");

  for (const esperado of caso.contiene ?? []) {
    const formas = lista(esperado);
    if (!formas.some((forma) => texto.includes(normalizar(forma)))) fallas.push(`falta ${formas.map((f) => `"${f}"`).join(" o ")}`);
  }
  for (const prohibido of caso.noContiene ?? []) {
    if (texto.includes(normalizar(prohibido))) fallas.push(`no debía decir "${prohibido}"`);
  }

  let citaCorrecta: boolean | undefined;
  if (caso.fuente !== undefined) {
    const citadas = new Set(fuentes.map((f) => normalizar(citaDe(f))));
    const esperadas = lista(caso.fuente);
    citaCorrecta = esperadas.some((f) => citadas.has(normalizar(f)));
    if (!citaCorrecta) fallas.push(`sin la fuente ${esperadas.map((f) => `"${f}"`).join(" o ")}`);
  }
  if (caso.documentoProhibido && fuentes.some((f) => normalizar(f.documento) === normalizar(caso.documentoProhibido!))) {
    fallas.push(`usó el documento prohibido "${caso.documentoProhibido}"`);
  }

  if (caso.niega && !seNego) fallas.push('no dijo "no tengo esa información"');
  if (caso.rechaza && !seNego && !RECHAZO.test(texto)) fallas.push("no se negó");

  return { acierto: fallas.length === 0, fallas, ...(citaCorrecta === undefined ? {} : { citaCorrecta }) };
}

const CATEGORIAS: Categoria[] = ["documentos", "datos_propios", "sin_respuesta", "fuera_de_dominio"];

export function resumir(resultados: Resultado[]) {
  const aciertos = resultados.filter((r) => r.calificacion.acierto).length;
  const conCita = resultados.filter((r) => r.calificacion.citaCorrecta !== undefined);
  const negaciones = resultados.filter((r) => r.caso.niega || r.caso.rechaza);
  return {
    total: resultados.length,
    aciertos,
    porcentaje: resultados.length === 0 ? 0 : Math.round((aciertos / resultados.length) * 1000) / 10,
    porCategoria: Object.fromEntries(
      CATEGORIAS.map((categoria) => {
        const deLaCategoria = resultados.filter((r) => r.caso.categoria === categoria);
        return [categoria, { total: deLaCategoria.length, aciertos: deLaCategoria.filter((r) => r.calificacion.acierto).length }];
      }),
    ) as Record<Categoria, { total: number; aciertos: number }>,
    citas: { total: conCita.length, correctas: conCita.filter((r) => r.calificacion.citaCorrecta).length },
    negaciones: { total: negaciones.length, correctas: negaciones.filter((r) => r.calificacion.acierto).length },
  };
}
