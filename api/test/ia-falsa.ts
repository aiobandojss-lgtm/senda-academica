import { env } from "cloudflare:workers";
import app from "../src/index";
import { conCookie, JSON_HEADERS } from "./utilidades";

// Dobles de prueba de Workers AI y Vectorize (RAG design.md D2): no tienen simulador local, y las pruebas no deben
// gastar cuota ni depender de la red. Tienen la misma forma que los bindings de Cloudflare (AI.run, upsert,
// deleteByIds, query), así que el código de producción se prueba sin cambios: solo cambia el binding que recibe.
// No es un archivo de pruebas: Vitest solo corre *.test.ts.

export const DIMENSIONES = 1024;

// Vector determinista a partir del texto: el mismo texto da siempre el mismo vector
export function vectorDe(texto: string): number[] {
  let semilla = 0;
  for (const caracter of texto) semilla = (semilla * 31 + caracter.charCodeAt(0)) % 1_000_003;
  return Array.from({ length: DIMENSIONES }, (_, i) => ((semilla + i * 7919) % 1000) / 1000);
}

// Vector con componentes elegidas, por ejemplo direccion({ 0: 0.8, 1: 0.6 }). Con vectores así la prueba decide
// la similitud exacta: el coseno entre direccion({0: 1}) y direccion({0: 0.8, 1: 0.6}) es 0,8
export function direccion(componentes: Record<number, number>): number[] {
  const vector = new Array<number>(DIMENSIONES).fill(0);
  for (const [indice, valor] of Object.entries(componentes)) vector[Number(indice)] = valor;
  return vector;
}

export class AiFalsa {
  llamadas: { modelo: string; entrada: unknown }[] = [];
  falla = false;
  // Vector fijo para un texto exacto; los demás textos usan vectorDe
  private fijos = new Map<string, number[]>();

  fijarVector(texto: string, vector: number[]) {
    this.fijos.set(texto, vector);
  }

  async run(modelo: string, entrada: { text: string[] }) {
    this.llamadas.push({ modelo, entrada });
    if (this.falla) throw new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons");
    return { shape: [entrada.text.length, DIMENSIONES], data: entrada.text.map((t) => this.fijos.get(t) ?? vectorDe(t)) };
  }
}

type VectorGuardado = { id: string; values: number[]; namespace?: string; metadata?: Record<string, unknown> };
type FiltroFalso = Record<string, { $in?: unknown[]; $eq?: unknown } | string | number>;

const coseno = (a: number[], b: number[]) => {
  let producto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    producto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  return normaA === 0 || normaB === 0 ? 0 : producto / Math.sqrt(normaA * normaB);
};

// ¿Cumple el filtro de metadatos? Solo lo que usa la API: igualdad y $in
const cumpleFiltro = (metadatos: Record<string, unknown> = {}, filtro: FiltroFalso = {}) =>
  Object.entries(filtro).every(([campo, condicion]) => {
    const valor = metadatos[campo];
    if (typeof condicion !== "object") return valor === condicion;
    if (condicion.$in) return condicion.$in.includes(valor);
    return valor === condicion.$eq;
  });

export class VectorizeFalso {
  vectores = new Map<string, VectorGuardado>();
  fallaAlGuardar = false;
  fallaAlBuscar = false;
  consultas: { topK?: number; namespace?: string; filter?: FiltroFalso }[] = [];

  // Como Vectorize: primero el espacio y el filtro de metadatos, luego los más parecidos por coseno
  async query(vector: number[], opciones: { topK?: number; namespace?: string; filter?: FiltroFalso } = {}) {
    this.consultas.push(opciones);
    if (this.fallaAlBuscar) throw new Error("VECTOR_QUERY_ERROR (code = 40006)");
    const matches = [...this.vectores.values()]
      .filter((v) => v.namespace === opciones.namespace && cumpleFiltro(v.metadata, opciones.filter))
      .map((v) => ({ id: v.id, score: coseno(vector, v.values) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opciones.topK ?? 5);
    return { matches, count: matches.length };
  }

  async upsert(vectores: VectorGuardado[]) {
    if (this.fallaAlGuardar) throw new Error("VECTOR_UPSERT_ERROR (code = 40001)");
    for (const v of vectores) this.vectores.set(v.id, v);
    return { mutationId: crypto.randomUUID() };
  }

  async deleteByIds(ids: string[]) {
    for (const id of ids) this.vectores.delete(id);
    return { mutationId: crypto.randomUUID() };
  }

  // Ids guardados en un espacio (namespace), ordenados
  idsEn(espacio: string): string[] {
    return [...this.vectores.values()].filter((v) => v.namespace === espacio).map((v) => v.id).sort();
  }
}

// Petición a la API con los bindings de IA reemplazados por los dobles (y, si hace falta, otras variables).
// app.request recibe el entorno como tercer argumento: es la misma app que atiende en producción.
export function pedirConIa(
  ia: { ai: AiFalsa; vectores: VectorizeFalso; variables?: Partial<Env> },
  token: string | null,
  metodo: "GET" | "PUT" | "POST" | "DELETE",
  ruta: string,
  cuerpo?: unknown,
) {
  const init: RequestInit = {
    method: metodo,
    headers: cuerpo === undefined ? {} : JSON_HEADERS,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  };
  const entorno = { ...env, ...ia.variables, AI: ia.ai, VECTORES: ia.vectores } as unknown as Env;
  return app.request(`https://senda.test/api${ruta}`, token ? conCookie(token, init as RequestInit & { headers: Record<string, string> }) : init, entorno);
}
