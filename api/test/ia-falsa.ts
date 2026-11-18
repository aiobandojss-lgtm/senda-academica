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

export class AiFalsa {
  llamadas: { modelo: string; entrada: unknown }[] = [];
  falla = false;

  async run(modelo: string, entrada: { text: string[] }) {
    this.llamadas.push({ modelo, entrada });
    if (this.falla) throw new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons");
    return { shape: [entrada.text.length, DIMENSIONES], data: entrada.text.map(vectorDe) };
  }
}

type VectorGuardado = { id: string; values: number[]; namespace?: string; metadata?: Record<string, unknown> };

export class VectorizeFalso {
  vectores = new Map<string, VectorGuardado>();
  fallaAlGuardar = false;

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
