import { textoDelFragmento } from "../dominio/fragmentacion";
import type { MensajeModelo, ModeloLenguaje, RespuestaModelo } from "./modelo";
import type { Coincidencia, GeneradorEmbeddings, IndiceVectorial } from "./servicios";

// Modo simulado del asistente para la prueba E2E (tarea RAG 4.2; RAG design.md D7).
//
// El E2E corre sin credenciales de Cloudflare (en tu equipo y en el CI), así que no hay Workers AI ni Vectorize.
// Con MODELO_SIMULADO=1 el modelo, los embeddings y el índice se reemplazan por reglas fijas sobre los fragmentos que
// ya están en D1: la prueba no gasta cuota y siempre recibe la misma respuesta. Todo lo demás es el código real (la
// ruta, el agente, el umbral de similitud y la validación de citas), así que el E2E prueba el camino completo.
//
// Nunca se usa en producción: wrangler.jsonc trae MODELO_SIMULADO=0, solo el build del E2E lo cambia, y aunque el
// valor llegara a producción, fuera de localhost se ignora.

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function usarModoSimulado(env: Env, url: string): boolean {
  if (env.MODELO_SIMULADO !== "1") return false;
  if (HOSTS_LOCALES.has(new URL(url).hostname)) return true;
  console.error("MODELO_SIMULADO=1 se ignora fuera de localhost: el asistente usa Workers AI y Vectorize");
  return false;
}

// Palabras que no dicen de qué trata una pregunta (sin tildes, como quedan después de normalizar)
const PALABRAS_VACIAS = new Set([
  "como", "con", "cual", "cuales", "cuando", "cuanto", "cuanta", "cuantos", "cuantas", "del", "donde", "esta", "este", "estas", "estos",
  "hay", "las", "los", "mis", "para", "pero", "por", "que", "quien", "sin", "sus", "tengo", "tiene", "tus", "una", "uno", "unos", "unas",
]);

// Palabras clave de un texto: sin tildes ni mayúsculas, sin palabras vacías ni de menos de 3 letras, y recortadas a
// 5 letras para que "talleres" y "taller" cuenten como la misma
export function palabrasClave(texto: string): Set<string> {
  return new Set(
    texto
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((palabra) => palabra.length >= 3 && !PALABRAS_VACIAS.has(palabra))
      .map((palabra) => palabra.slice(0, 5)),
  );
}

// Mismo tamaño que el índice real (1024 dimensiones, D2)
const DIMENSIONES = 1024;

// Posición de una palabra en el vector (hash FNV-1a)
function posicion(palabra: string): number {
  let hash = 2166136261;
  for (const caracter of palabra) hash = Math.imul(hash ^ caracter.charCodeAt(0), 16777619);
  return (hash >>> 0) % DIMENSIONES;
}

// "Embedding" simulado: un 1 en la posición de cada palabra clave
function vectorDe(texto: string): number[] {
  const vector = new Array<number>(DIMENSIONES).fill(0);
  for (const palabra of palabrasClave(texto)) vector[posicion(palabra)] = 1;
  return vector;
}

export class EmbeddingsSimulados implements GeneradorEmbeddings {
  async generar(textos: string[]) {
    return textos.map(vectorDe);
  }
}

type FilaFragmento = { id: number; titulo: string; seccion: string; contenido: string };

// Índice simulado: no guarda nada, porque el texto de cada fragmento ya vive en D1 (D3). Al buscar, la similitud es
// la fracción de las palabras clave de la pregunta que aparecen en el fragmento (1 = todas)
export class IndiceSimulado implements IndiceVectorial {
  readonly espacio = "simulado";

  constructor(private readonly db: D1Database) {}

  async guardar() {}

  async eliminar() {}

  async buscar(vector: number[], { carreraId, maximo }: { carreraId: number; maximo: number }): Promise<Coincidencia[]> {
    const consulta = vector.flatMap((valor, i) => (valor > 0 ? [i] : []));
    if (consulta.length === 0) return [];
    // Como el filtro de Vectorize (D4): documentos generales o de la carrera del estudiante
    const { results } = await this.db
      .prepare(
        `SELECT f.id, d.titulo, f.seccion, f.contenido
           FROM fragmentos f JOIN documentos d ON d.id = f.documento_id
          WHERE d.carrera_id IS NULL OR d.carrera_id = ?
          ORDER BY f.id`,
      )
      .bind(carreraId)
      .all<FilaFragmento>();
    return results
      .map((f) => {
        const delFragmento = vectorDe(textoDelFragmento(f.titulo, f.seccion, f.contenido));
        return { fragmentoId: f.id, similitud: consulta.filter((i) => delFragmento[i] > 0).length / consulta.length };
      })
      .filter((c) => c.similitud > 0)
      .sort((a, b) => b.similitud - a.similitud)
      .slice(0, maximo);
  }
}

// La frase del fragmento con más palabras clave de la pregunta
function fraseMasParecida(contenido: string, pregunta: string): string {
  const claves = palabrasClave(pregunta);
  const frases = contenido
    .split(/(?<=[.!?])\s+|\n+/)
    .map((frase) => frase.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  let mejor = frases[0] ?? contenido;
  let mejorPuntaje = -1;
  for (const frase of frases) {
    const puntaje = [...palabrasClave(frase)].filter((palabra) => claves.has(palabra)).length;
    if (puntaje > mejorPuntaje) [mejor, mejorPuntaje] = [frase, puntaje];
  }
  return mejor;
}

// Modelo simulado: siempre busca en los documentos con la pregunta y responde con la frase más parecida del mejor
// resultado y su cita, o "No tengo esa información." si no hay resultados. No consulta datos del estudiante: el E2E
// solo lo usa para preguntas sobre documentos
export class ModeloSimulado implements ModeloLenguaje {
  async responder(mensajes: MensajeModelo[]): Promise<RespuestaModelo> {
    const pregunta = mensajes.findLast((m) => m.rol === "usuario")?.contenido ?? "";
    const ultimo = mensajes.at(-1);
    if (ultimo?.rol !== "herramienta") {
      return { texto: "", llamadas: [{ id: "simulado-1", nombre: "buscar_documentos", argumentos: { consulta: pregunta } }] };
    }
    const { resultados = [] } = JSON.parse(ultimo.contenido) as { resultados?: { fuente: string; contenido: string }[] };
    const [mejor] = resultados;
    if (!mejor) return { texto: "No tengo esa información.", llamadas: [] };
    return { texto: `${fraseMasParecida(mejor.contenido, pregunta)} [${mejor.fuente}]`, llamadas: [] };
  }
}
