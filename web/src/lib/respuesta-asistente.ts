// Respuesta del asistente Senda → bloques que la pantalla dibuja con React (tarea RAG 3.4).
//
// Es un intérprete propio y pequeño, no una librería de Markdown: entiende solo lo que piden las instrucciones del
// sistema (api/src/rag/agente.ts): párrafos, listas, negritas y citas entre corchetes. Nunca produce HTML: cada
// pedazo es texto que React escapa, así una respuesta del modelo no puede inyectar etiquetas en la página.

export type FuenteAsistente = { documento: string; seccion: string };

export type Segmento =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrita"; texto: string }
  // La cita se cambia por el número de su fuente, que la pantalla lista debajo de la respuesta
  | { tipo: "cita"; numero: number; fuente: FuenteAsistente };

export type Bloque = { tipo: "parrafo"; lineas: Segmento[][] } | { tipo: "lista"; ordenada: boolean; items: Segmento[][] };

// La cita como la escribe el modelo y como la valida el servidor: "Documento – Sección"
export const textoDeFuente = (fuente: FuenteAsistente) => `${fuente.documento} – ${fuente.seccion}`;

// La misma comparación de la validación del servidor (api/src/rag/agente.ts): sin importar mayúsculas, el tipo de
// raya, los espacios ni un punto final
const normalizar = (cita: string) =>
  cita
    .toLowerCase()
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();

// **negrita** | [texto](enlace) | [cita]
const EN_LINEA = /\*\*(.+?)\*\*|\[([^[\]]+)\]\([^)\s]*\)|\[([^[\]]+)\]/g;
const VINETA = /^\s*[-*•]\s+(.*)$/;
const NUMERADA = /^\s*\d+[.)]\s+(.*)$/;
const TITULO = /^\s*#{1,6}\s+(.*)$/;
const SEPARADOR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

function analizarLinea(linea: string, fuentes: FuenteAsistente[], numeroDe: Map<string, number>): Segmento[] {
  const segmentos: Segmento[] = [];
  const agregarTexto = (texto: string) => {
    if (!texto) return;
    const ultimo = segmentos.at(-1);
    if (ultimo?.tipo === "texto") ultimo.texto += texto;
    else segmentos.push({ tipo: "texto", texto });
  };

  let desde = 0;
  for (const m of linea.matchAll(EN_LINEA)) {
    agregarTexto(linea.slice(desde, m.index));
    desde = m.index + m[0].length;
    const [completo, negrita, textoEnlace, cita] = m;
    if (negrita !== undefined) {
      segmentos.push({ tipo: "negrita", texto: negrita });
    } else if (textoEnlace !== undefined) {
      // Solo el texto: la pantalla no abre enlaces que escriba el modelo
      agregarTexto(textoEnlace);
    } else {
      const numero = numeroDe.get(normalizar(cita));
      if (numero === undefined) {
        agregarTexto(completo);
        continue;
      }
      // El número queda pegado a la palabra, como una nota al pie
      const ultimo = segmentos.at(-1);
      if (ultimo?.tipo === "texto") {
        ultimo.texto = ultimo.texto.trimEnd();
        if (!ultimo.texto) segmentos.pop();
      }
      segmentos.push({ tipo: "cita", numero, fuente: fuentes[numero - 1] });
    }
  }
  agregarTexto(linea.slice(desde));
  return segmentos;
}

export function analizarRespuesta(texto: string, fuentes: FuenteAsistente[]): Bloque[] {
  // Cada fuente con su número: el orden de la lista de fuentes (el servidor la arma en el orden en que se citan)
  const numeroDe = new Map(fuentes.map((fuente, i) => [normalizar(textoDeFuente(fuente)), i + 1]));
  const bloques: Bloque[] = [];
  let actual: Bloque | null = null;

  for (const linea of texto.replace(/\r\n?/g, "\n").split("\n")) {
    if (!linea.trim()) {
      if (actual) bloques.push(actual);
      actual = null;
      continue;
    }
    if (SEPARADOR.test(linea)) continue;

    const vineta = VINETA.exec(linea);
    const item = vineta ?? NUMERADA.exec(linea);
    if (item) {
      const ordenada = !vineta;
      if (actual?.tipo !== "lista" || actual.ordenada !== ordenada) {
        if (actual) bloques.push(actual);
        actual = { tipo: "lista", ordenada, items: [] };
      }
      actual.items.push(analizarLinea(item[1].trim(), fuentes, numeroDe));
      continue;
    }

    const titulo = TITULO.exec(linea);
    const segmentos: Segmento[] = titulo ? [{ tipo: "negrita", texto: titulo[1].trim() }] : analizarLinea(linea.trim(), fuentes, numeroDe);
    if (actual?.tipo !== "parrafo") {
      if (actual) bloques.push(actual);
      actual = { tipo: "parrafo", lineas: [] };
    }
    actual.lineas.push(segmentos);
  }
  if (actual) bloques.push(actual);
  return bloques;
}
