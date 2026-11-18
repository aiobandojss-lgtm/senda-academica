import { describe, expect, it } from "vitest";
import { DEFINICIONES_HERRAMIENTAS } from "../src/rag/herramientas";
import { ModeloChatWorkersAi } from "../src/rag/modelo";
import { ServicioIaNoDisponible } from "../src/rag/servicios";

// Tarea RAG 3.2: adaptador del formato de chat compatible con OpenAI que aceptan gpt-oss-20b y llama-3.3 en Workers
// AI (design.md D1 y D2, verificado con un ciclo real de dos pasos). Aquí se prueba la traducción, con un binding falso.

class AiQueResponde {
  peticiones: { modelo: string; entrada: Record<string, unknown> }[] = [];
  constructor(private readonly respuesta: unknown | (() => never)) {}
  async run(modelo: string, entrada: Record<string, unknown>) {
    this.peticiones.push({ modelo, entrada });
    return typeof this.respuesta === "function" ? (this.respuesta as () => never)() : this.respuesta;
  }
}

const respuestaChat = (mensaje: Record<string, unknown>) => ({ choices: [{ message: mensaje, finish_reason: "stop" }] });
const adaptador = (ai: AiQueResponde) => new ModeloChatWorkersAi(ai as unknown as Ai, "@cf/openai/gpt-oss-20b");

describe("ModeloChatWorkersAi", () => {
  it("traduce los mensajes y las herramientas al formato de chat", async () => {
    const ai = new AiQueResponde(respuestaChat({ content: "Listo" }));
    await adaptador(ai).responder(
      [
        { rol: "sistema", contenido: "Eres Senda" },
        { rol: "usuario", contenido: "¿Cuánto debo?" },
        { rol: "asistente", contenido: "", llamadas: [{ id: "c1", nombre: "mi_estado_de_cuenta", argumentos: {} }] },
        { rol: "herramienta", llamadaId: "c1", contenido: '{"totalAdeudado":180000}' },
      ],
      DEFINICIONES_HERRAMIENTAS,
    );

    const { modelo, entrada } = ai.peticiones[0];
    expect(modelo).toBe("@cf/openai/gpt-oss-20b");
    expect(entrada.messages).toEqual([
      { role: "system", content: "Eres Senda" },
      { role: "user", content: "¿Cuánto debo?" },
      { role: "assistant", content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "mi_estado_de_cuenta", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: '{"totalAdeudado":180000}' },
    ]);
    // Temperatura baja: respuestas consistentes entre corridas, lo habitual en preguntas con fuente (tarea 3.3)
    expect(entrada.temperature).toBe(0.2);
    expect(entrada.tools).toContainEqual({
      type: "function",
      function: { name: "buscar_documentos", description: expect.any(String), parameters: expect.objectContaining({ required: ["consulta"] }) },
    });
  });

  it("lee el texto final y las llamadas a herramientas, con los argumentos convertidos de JSON", async () => {
    const ai = new AiQueResponde(
      respuestaChat({
        content: null,
        tool_calls: [{ id: "x9", type: "function", function: { name: "buscar_documentos", arguments: '{\n  "consulta": "nota mínima"\n}' } }],
      }),
    );
    const respuesta = await adaptador(ai).responder([{ rol: "usuario", contenido: "¿Nota mínima?" }], DEFINICIONES_HERRAMIENTAS);
    expect(respuesta).toEqual({ texto: "", llamadas: [{ id: "x9", nombre: "buscar_documentos", argumentos: { consulta: "nota mínima" } }] });
  });

  it("argumentos que no son JSON válido llegan vacíos: la herramienta responde con un error que el modelo puede leer", async () => {
    const ai = new AiQueResponde(respuestaChat({ content: "", tool_calls: [{ id: "x1", function: { name: "buscar_documentos", arguments: "{consulta:" } }] }));
    const respuesta = await adaptador(ai).responder([{ rol: "usuario", contenido: "x" }], DEFINICIONES_HERRAMIENTAS);
    expect(respuesta.llamadas[0].argumentos).toEqual({});
  });

  it("acepta también el formato nativo de Workers AI (response y tool_calls)", async () => {
    const ai = new AiQueResponde({ response: "Hola", tool_calls: [{ name: "mis_notas", arguments: {} }] });
    const respuesta = await adaptador(ai).responder([{ rol: "usuario", contenido: "x" }], DEFINICIONES_HERRAMIENTAS);
    expect(respuesta.texto).toBe("Hola");
    expect(respuesta.llamadas).toEqual([{ id: expect.any(String), nombre: "mis_notas", argumentos: {} }]);
  });

  it("si Workers AI falla (por ejemplo, sin cuota), lanza ServicioIaNoDisponible", async () => {
    const ai = new AiQueResponde(() => {
      throw new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons");
    });
    await expect(adaptador(ai).responder([{ rol: "usuario", contenido: "x" }], DEFINICIONES_HERRAMIENTAS)).rejects.toBeInstanceOf(ServicioIaNoDisponible);
  });

  it("una respuesta sin el formato esperado también es ServicioIaNoDisponible", async () => {
    const ai = new AiQueResponde({ algo: "inesperado" });
    await expect(adaptador(ai).responder([{ rol: "usuario", contenido: "x" }], DEFINICIONES_HERRAMIENTAS)).rejects.toBeInstanceOf(ServicioIaNoDisponible);
  });
});
