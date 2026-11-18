import type { DEFINICIONES_HERRAMIENTAS } from "./herramientas";
import { ServicioIaNoDisponible } from "./servicios";

// Modelo de lenguaje detrás de una interfaz (RAG design.md D1): el agente no conoce el formato de ningún proveedor.
// Hoy hay un adaptador para el formato de chat compatible con OpenAI, que aceptan los dos candidatos de Workers AI
// (gpt-oss-20b y llama-3.3, verificado con un ciclo real en la tarea 3.2). Las pruebas usan un modelo con guion.

export type LlamadaHerramienta = { id: string; nombre: string; argumentos: unknown };

export type MensajeModelo =
  | { rol: "sistema" | "usuario"; contenido: string }
  | { rol: "asistente"; contenido: string; llamadas?: LlamadaHerramienta[] }
  | { rol: "herramienta"; llamadaId: string; contenido: string };

// Texto final (si no pidió herramientas) o las herramientas que pidió
export type RespuestaModelo = { texto: string; llamadas: LlamadaHerramienta[] };

export type DefinicionHerramienta = (typeof DEFINICIONES_HERRAMIENTAS)[number];

export interface ModeloLenguaje {
  responder(mensajes: MensajeModelo[], herramientas: readonly DefinicionHerramienta[]): Promise<RespuestaModelo>;
}

// Tope de la respuesta. gpt-oss "razona" antes de responder y esos tokens también cuentan
const MAXIMO_TOKENS = 1000;

const ROLES = { sistema: "system", usuario: "user", asistente: "assistant", herramienta: "tool" } as const;

type LlamadaChat = { id?: string; type?: string; function?: { name?: string; arguments?: unknown }; name?: string; arguments?: unknown };
type SalidaChat = {
  choices?: { message?: { content?: string | null; tool_calls?: LlamadaChat[] | null } }[];
  // Formato nativo de Workers AI, por si un modelo responde así
  response?: string | null;
  tool_calls?: LlamadaChat[] | null;
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

    return {
      texto: (mensaje.content ?? "").trim(),
      llamadas: (mensaje.tool_calls ?? []).map((l, i) => ({
        id: l.id ?? `llamada-${i + 1}`,
        nombre: l.function?.name ?? l.name ?? "",
        argumentos: leerArgumentos(l.function?.arguments ?? l.arguments),
      })),
    };
  }
}
