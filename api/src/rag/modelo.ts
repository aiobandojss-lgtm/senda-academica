import type { DEFINICIONES_HERRAMIENTAS } from "./herramientas";
import { ServicioIaNoDisponible } from "./servicios";
import { ModeloSimulado } from "./simulado";

// Modelo de lenguaje detrás de una interfaz (RAG design.md D1): el agente no conoce el formato de ningún proveedor.
// Hoy hay un adaptador para el formato de chat compatible con OpenAI, que aceptan los dos candidatos de Workers AI
// (gpt-oss-20b y llama-3.3, verificado con un ciclo real en la tarea 3.2). Las pruebas usan un modelo con guion.

export type LlamadaHerramienta = { id: string; nombre: string; argumentos: unknown };

export type MensajeModelo =
  | { rol: "sistema" | "usuario"; contenido: string }
  | { rol: "asistente"; contenido: string; llamadas?: LlamadaHerramienta[] }
  | { rol: "herramienta"; llamadaId: string; contenido: string };

// Tokens de una llamada al modelo. Workers AI cobra cada modelo por tokens de entrada y de salida (convertidos a
// neuronas), así que con ellos se mide el costo de cada pregunta (tarea 4.1)
export type UsoTokens = { entrada: number; salida: number };

// Texto final (si no pidió herramientas) o las herramientas que pidió; `uso` solo si el modelo lo reporta
export type RespuestaModelo = { texto: string; llamadas: LlamadaHerramienta[]; uso?: UsoTokens };

export type DefinicionHerramienta = (typeof DEFINICIONES_HERRAMIENTAS)[number];

export interface ModeloLenguaje {
  responder(mensajes: MensajeModelo[], herramientas: readonly DefinicionHerramienta[]): Promise<RespuestaModelo>;
}

// El modelo del asistente: el de MODELO_CHAT, elegido por la evaluación (tarea 4.1). `simulado` solo lo activa la
// prueba E2E en localhost (usarModoSimulado, tarea 4.2)
export const modeloDelAsistente = (env: Env, simulado = false): ModeloLenguaje =>
  simulado ? new ModeloSimulado() : new ModeloChatWorkersAi(env.AI, env.MODELO_CHAT);

// Tope de la respuesta. gpt-oss "razona" antes de responder y esos tokens también cuentan
const MAXIMO_TOKENS = 1000;
const TEMPERATURA = 0.2;

const ROLES = { sistema: "system", usuario: "user", asistente: "assistant", herramienta: "tool" } as const;

type LlamadaChat = { id?: string; type?: string; function?: { name?: string; arguments?: unknown }; name?: string; arguments?: unknown };
type SalidaChat = {
  choices?: { message?: { content?: string | null; tool_calls?: LlamadaChat[] | null } }[];
  // Formato nativo de Workers AI, por si un modelo responde así
  response?: string | null;
  tool_calls?: LlamadaChat[] | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

// Los argumentos llegan como texto JSON; si no son JSON válido, llegan vacíos y la herramienta responde con un
// error que el modelo puede leer y corregir
function leerArgumentos(argumentos: unknown): unknown {
  if (typeof argumentos !== "string") return argumentos ?? {};
  try {
    return JSON.parse(argumentos);
  } catch {
    return {};
  }
}

export class ModeloChatWorkersAi implements ModeloLenguaje {
  constructor(
    private readonly ai: Ai,
    private readonly modelo: string,
  ) {}

  async responder(mensajes: MensajeModelo[], herramientas: readonly DefinicionHerramienta[]): Promise<RespuestaModelo> {
    const entrada = {
      messages: mensajes.map((m) => {
        if (m.rol === "herramienta") return { role: ROLES.herramienta, tool_call_id: m.llamadaId, content: m.contenido };
        if (m.rol === "asistente" && m.llamadas?.length) {
          return {
            role: ROLES.asistente,
            content: m.contenido,
            tool_calls: m.llamadas.map((l) => ({
              id: l.id,
              type: "function",
              function: { name: l.nombre, arguments: JSON.stringify(l.argumentos ?? {}) },
            })),
          };
        }
        return { role: ROLES[m.rol], content: m.contenido };
      }),
      tools: herramientas.map((h) => ({ type: "function", function: { name: h.nombre, description: h.descripcion, parameters: h.parametros } })),
      max_tokens: MAXIMO_TOKENS,
      // Baja: respuestas consistentes entre corridas, lo habitual en preguntas con fuente (tarea 3.3)
      temperature: TEMPERATURA,
    };

    let salida: SalidaChat;
    try {
      // El modelo sale de una variable (string): el tipo del catálogo no se puede verificar en compilación
      salida = (await this.ai.run(this.modelo as "@cf/meta/llama-3.3-70b-instruct-fp8-fast", entrada as never)) as SalidaChat;
    } catch (error) {
      throw new ServicioIaNoDisponible(error);
    }

    const mensaje = salida.choices?.[0]?.message ?? (salida.response !== undefined || salida.tool_calls ? { content: salida.response, tool_calls: salida.tool_calls } : null);
    if (!mensaje) throw new ServicioIaNoDisponible(`El modelo ${this.modelo} respondió en un formato desconocido`);

    const { prompt_tokens: tokensEntrada, completion_tokens: tokensSalida } = salida.usage ?? {};
    return {
      texto: (mensaje.content ?? "").trim(),
      llamadas: (mensaje.tool_calls ?? []).map((l, i) => ({
        id: l.id ?? `llamada-${i + 1}`,
        nombre: l.function?.name ?? l.name ?? "",
        argumentos: leerArgumentos(l.function?.arguments ?? l.arguments),
      })),
      ...(tokensEntrada !== undefined && tokensSalida !== undefined ? { uso: { entrada: tokensEntrada, salida: tokensSalida } } : {}),
    };
  }
}
