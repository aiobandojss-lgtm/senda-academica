// Servicios de IA del asistente detrás de interfaces pequeñas (RAG design.md D1), como AlmacenArchivos: el resto de
// la API no conoce Workers AI ni Vectorize. En las pruebas se reemplazan los bindings por dobles (api/test/ia-falsa.ts).

import { EmbeddingsSimulados, IndiceSimulado } from "./simulado";

// Convierte textos en vectores (embeddings) con el modelo de MODELO_EMBEDDINGS
export interface GeneradorEmbeddings {
  generar(textos: string[]): Promise<number[][]>;
}

export type VectorFragmento = { fragmentoId: number; valores: number[]; documentoId: number; carreraId: number | null; tipo: string };

export type Coincidencia = { fragmentoId: number; similitud: number };

// Índice vectorial de los fragmentos. Guarda solo vectores y metadatos: el texto vive en D1 (D3)
export interface IndiceVectorial {
  guardar(vectores: VectorFragmento[]): Promise<void>;
  // Eliminar ids que no existen no es un error
  eliminar(fragmentoIds: number[]): Promise<void>;
  // Los más parecidos entre los documentos generales y los de la carrera, de mayor a menor similitud (coseno)
  buscar(vector: number[], opciones: { carreraId: number; maximo: number }): Promise<Coincidencia[]>;
}

// Workers AI o Vectorize no respondieron (cuota agotada, servicio caído). Las rutas lo traducen a 503 (D11)
export class ServicioIaNoDisponible extends Error {
  constructor(causa: unknown) {
    super(causa instanceof Error ? causa.message : String(causa));
    this.name = "ServicioIaNoDisponible";
  }
}

// Textos por llamada a Workers AI y vectores por llamada a Vectorize: lotes pequeños para no pasar los límites
const LOTE_EMBEDDINGS = 20;
const LOTE_VECTORES = 100;

const enLotes = <T>(elementos: T[], tamano: number): T[][] =>
  Array.from({ length: Math.ceil(elementos.length / tamano) }, (_, i) => elementos.slice(i * tamano, (i + 1) * tamano));

export class EmbeddingsWorkersAi implements GeneradorEmbeddings {
  constructor(
    private readonly ai: Ai,
    private readonly modelo: string,
  ) {}

  async generar(textos: string[]) {
    const vectores: number[][] = [];
    for (const lote of enLotes(textos, LOTE_EMBEDDINGS)) {
      let salida: { data?: number[][] };
      try {
        // El modelo sale de una variable (string); el tipo de bge-m3 describe la forma de la respuesta
        salida = (await this.ai.run(this.modelo as "@cf/baai/bge-m3", { text: lote })) as { data?: number[][] };
      } catch (error) {
        throw new ServicioIaNoDisponible(error);
      }
      if (!salida.data || salida.data.length !== lote.length) {
        throw new ServicioIaNoDisponible(`El modelo ${this.modelo} no devolvió un vector por cada texto`);
      }
      vectores.push(...salida.data);
    }
    return vectores;
  }
}

// Espacios (namespaces) válidos de Vectorize (D2): "produccion" en Cloudflare y "local" en `npm run dev`
const ESPACIOS = ["produccion", "local"] as const;
export type EspacioRag = (typeof ESPACIOS)[number];

export class IndiceVectorize implements IndiceVectorial {
  constructor(
    private readonly indice: VectorizeIndex,
    readonly espacio: EspacioRag,
  ) {}

  // El id de un vector es único en todo el índice, que comparten desarrollo y producción: lleva el espacio
  idDe(fragmentoId: number) {
    return `${this.espacio}:${fragmentoId}`;
  }

  async guardar(vectores: VectorFragmento[]) {
    for (const lote of enLotes(vectores, LOTE_VECTORES)) {
      await this.conServicio(() =>
        this.indice.upsert(
          lote.map((v) => ({
            id: this.idDe(v.fragmentoId),
            values: v.valores,
            namespace: this.espacio,
            // Los documentos generales llevan carrera_id 0: así se filtran con $in [0, carrera] (D2 y D4)
            metadata: { documento_id: v.documentoId, carrera_id: v.carreraId ?? 0, tipo: v.tipo },
          })),
        ),
      );
    }
  }

  async eliminar(fragmentoIds: number[]) {
    for (const lote of enLotes(fragmentoIds, LOTE_VECTORES)) {
      await this.conServicio(() => this.indice.deleteByIds(lote.map((id) => this.idDe(id))));
    }
  }

  async buscar(vector: number[], { carreraId, maximo }: { carreraId: number; maximo: number }) {
    let resultado: VectorizeMatches;
    try {
      resultado = await this.indice.query(vector, {
        topK: maximo,
        namespace: this.espacio,
        // Vectorize no tiene "o" entre dos campos: los generales llevan carrera_id 0 y se piden con $in (D2 y D4)
        filter: { carrera_id: { $in: [0, carreraId] } },
        returnMetadata: "none",
      });
    } catch (error) {
      throw new ServicioIaNoDisponible(error);
    }
    const prefijo = `${this.espacio}:`;
    return resultado.matches.flatMap((m) => {
      const fragmentoId = Number(m.id.slice(prefijo.length));
      return m.id.startsWith(prefijo) && Number.isSafeInteger(fragmentoId) ? [{ fragmentoId, similitud: m.score }] : [];
    });
  }

  private async conServicio(operacion: () => Promise<unknown>) {
    try {
      await operacion();
    } catch (error) {
      throw new ServicioIaNoDisponible(error);
    }
  }
}

// Valida RAG_ESPACIO en tiempo de ejecución, como ALMACEN_ARCHIVOS: un valor mal escrito crearía en silencio un
// espacio nuevo y vacío, y el asistente diría que no sabe nada
export function espacioRag(env: Env): EspacioRag {
  const espacio = ESPACIOS.find((e) => e === env.RAG_ESPACIO);
  if (!espacio) throw new Error(`RAG_ESPACIO debe ser "produccion" o "local", y es "${env.RAG_ESPACIO}"`);
  return espacio;
}

// `simulado` solo lo activa la prueba E2E en localhost (usarModoSimulado, tarea 4.2): sin Workers AI ni Vectorize
export function serviciosRag(env: Env, simulado = false): { embeddings: GeneradorEmbeddings; indice: IndiceVectorial & { espacio: string } } {
  if (simulado) return { embeddings: new EmbeddingsSimulados(), indice: new IndiceSimulado(env.DB) };
  return { embeddings: new EmbeddingsWorkersAi(env.AI, env.MODELO_EMBEDDINGS), indice: new IndiceVectorize(env.VECTORES, espacioRag(env)) };
}
