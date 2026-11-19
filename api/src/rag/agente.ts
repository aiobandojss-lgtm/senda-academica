import { hoyEnBogota } from "../dominio/mora";
import { citaDe, DEFINICIONES_HERRAMIENTAS, ejecutarHerramienta, type ContextoHerramientas } from "./herramientas";
import type { MensajeModelo, ModeloLenguaje, UsoTokens } from "./modelo";

// Agente del asistente Senda (spec `asistente-academico`; RAG design.md D4 a D6). Es un ciclo de function calling:
// el modelo pide herramientas, el agente las ejecuta con el contexto de la sesión y le devuelve los resultados,
// hasta que el modelo responde con texto o se cumplen 4 pasos. Es el mismo patrón de nodos y herramientas de
// LangGraph, escrito a mano para no cargar la librería en el Worker.

export const MAXIMO_PASOS = 4;
const HERRAMIENTAS_DE_DATOS = new Set(["mis_actividades_pendientes", "mis_notas", "mi_estado_de_cuenta"]);

export type TurnoHistorial = { rol: "usuario" | "asistente"; contenido: string };
export type Fuente = { documento: string; seccion: string };

export type EntradaAgente = {
  modelo: ModeloLenguaje;
  contexto: ContextoHerramientas;
  // D6: al modelo solo le llegan el nombre de pila y la carrera del estudiante
  perfil: { nombrePila: string; carrera: string };
  config: { producto: string; fundacion: string; contacto: string };
  // Turnos anteriores leídos de D1, nunca del navegador (D8)
  historial: TurnoHistorial[];
  pregunta: string;
  hoy?: string;
};

// Por qué la validación (D5) reemplazó una respuesta. Va a los registros y a la evaluación (tarea 4.1)
export type MotivoReemplazo = "sin_respuesta" | "cita_invalida" | "cifra_sin_fuente" | "sin_cita" | "maximo_pasos";

export type ResultadoAgente = {
  respuesta: string;
  fuentes: Fuente[];
  // true si la validación (D5) cambió la respuesta del modelo por "no tengo esa información"
  reemplazada: boolean;
  motivo?: MotivoReemplazo;
  // Las citas que no correspondían a ningún fragmento recuperado (nombres de documentos, sin datos personales)
  citasInvalidas?: string[];
  pasos: number;
  herramientas: string[];
  // Suma de todos los pasos, también si la respuesta se reemplazó: es el costo de la pregunta (tarea 4.1)
  tokens: UsoTokens;
};

// Guarda 2 de D5: instrucciones estrictas. Sin ejemplos de citas: en la prueba real, llama copió la palabra
// "Documento" de un ejemplo (tarea 3.2); por eso se pide copiar el campo "fuente" tal cual
export function instruccionesDelSistema(perfil: EntradaAgente["perfil"], config: EntradaAgente["config"], hoy: string): string {
  const { nombrePila, carrera } = perfil;
  const { producto, fundacion } = config;
  return [
    `Eres ${producto}, el asistente académico de ${fundacion}. Hablas con ${nombrePila}, estudiante de ${carrera}. Hoy es ${hoy} (hora de Colombia).`,
    "",
    "Reglas:",
    "1. Responde siempre en español, de forma breve, clara y amable. No uses tablas: el estudiante lee desde el celular. Usa frases cortas o listas.",
    "2. Usa solo la información que te den las herramientas. Nunca uses tu propio conocimiento para normas, fechas, valores, notas, requisitos ni contenidos de los programas.",
    `3. Siempre llama al menos una herramienta antes de responder cualquier pregunta sobre ${fundacion}, aunque creas saber la respuesta. Para normas, fechas, el calendario, pagos, entregas, horarios, servicios o el plan de estudios, usa buscar_documentos. Para los datos de ${nombrePila}, usa mis_actividades_pendientes, mis_notas o mi_estado_de_cuenta. Sin herramientas solo puedes saludar o negarte.`,
    '4. Cuando respondas con información de buscar_documentos, cita la fuente copiando exactamente el campo "fuente" del resultado, entre corchetes, al final de la frase que la usa. No inventes ni cambies las fuentes.',
    '5. Si las herramientas no traen la información que se pide, responde solo: "No tengo esa información."',
    `6. Solo puedes consultar los datos de ${nombrePila}. Si te piden datos de otra persona, responde que solo puedes consultar sus propios datos.`,
    `7. Solo ayudas con la vida académica y administrativa en ${fundacion}. Si te preguntan por otro tema, responde que solo ayudas con temas de ${fundacion}. No resuelvas talleres ni evaluaciones, ni expliques temas de los cursos.`,
    "8. Escribe los valores de dinero en pesos colombianos, con el signo $ y punto de miles.",
  ].join("\n");
}

export const respuestaNoSe = (contacto: string) => `No tengo esa información. Te sugiero consultarlo con ${contacto}.`;

// Todo texto entre corchetes cuenta como cita y debe ser una fuente recuperada, tenga o no la raya: en la prueba
// real (tarea 3.3) gpt-oss respondió de memoria "**4.0**. [Reglamento Académico]". Se excluyen los enlaces
// de Markdown, [texto](url), que no son citas
const ENTRE_CORCHETES = /\[([^[\]]+)\](?!\()/g;
const CIFRA = /\d/;
// Compara citas sin importar mayúsculas, el tipo de raya, los espacios o un punto final
const normalizar = (cita: string) =>
  cita
    .toLowerCase()
    .replace(/[–—-]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();

export async function responderPregunta(entrada: EntradaAgente): Promise<ResultadoAgente> {
  const { modelo, contexto, config } = entrada;
  const mensajes: MensajeModelo[] = [
    { rol: "sistema", contenido: instruccionesDelSistema(entrada.perfil, config, entrada.hoy ?? hoyEnBogota()) },
    ...entrada.historial,
    { rol: "usuario", contenido: entrada.pregunta },
  ];
  // Fuentes de los fragmentos que el agente de verdad recuperó: lo único que se puede citar
  const recuperadas = new Map<string, Fuente>();
  const usadas: string[] = [];
  let buscoDocumentos = false;
  let consultoDatos = false;
  // Cada paso envía otra vez todo el contexto: el costo de la pregunta es la suma de los pasos
  const tokens: UsoTokens = { entrada: 0, salida: 0 };

  const noSe = (pasos: number, motivo: MotivoReemplazo, citasInvalidas?: string[]): ResultadoAgente => ({
    respuesta: respuestaNoSe(config.contacto),
    fuentes: [],
    reemplazada: true,
    motivo,
    ...(citasInvalidas ? { citasInvalidas } : {}),
    pasos,
    herramientas: [...new Set(usadas)],
    tokens,
  });

  for (let paso = 1; paso <= MAXIMO_PASOS; paso++) {
    const { texto, llamadas, uso } = await modelo.responder(mensajes, DEFINICIONES_HERRAMIENTAS);
    tokens.entrada += uso?.entrada ?? 0;
    tokens.salida += uso?.salida ?? 0;

    if (llamadas.length === 0) {
      // Guarda 3 de D5: validación de la respuesta
      if (!texto) return noSe(paso, "sin_respuesta");
      const citas = [...texto.matchAll(ENTRE_CORCHETES)].map((m) => m[1]);
      const invalidas = citas.filter((c) => !recuperadas.has(normalizar(c)));
      if (invalidas.length > 0) return noSe(paso, "cita_invalida", invalidas.slice(0, 3).map((c) => c.slice(0, 80)));
      // Sin ninguna herramienta, la respuesta no tiene fuente: solo vale un saludo o una negativa. Una cifra (nota,
      // fecha, valor) sin fuente es justo la alucinación que hay que evitar
      if (usadas.length === 0 && CIFRA.test(texto)) return noSe(paso, "cifra_sin_fuente");
      const fuentes = [...new Set(citas.map(normalizar))].map((c) => recuperadas.get(c)!);
      // Buscó en los documentos y no consultó datos propios: sin cita válida, la respuesta no tiene fundamento
      if (buscoDocumentos && !consultoDatos && fuentes.length === 0) return noSe(paso, "sin_cita");
      return { respuesta: texto, fuentes, reemplazada: false, pasos: paso, herramientas: [...new Set(usadas)], tokens };
    }

    mensajes.push({ rol: "asistente", contenido: texto, llamadas });
    for (const llamada of llamadas) {
      usadas.push(llamada.nombre);
      // El contexto (estudiante y carrera) sale de la sesión; los argumentos del modelo no lo pueden cambiar
      const resultado = await ejecutarHerramienta(llamada.nombre, llamada.argumentos, contexto);
      if (llamada.nombre === "buscar_documentos") {
        buscoDocumentos = true;
        for (const r of (resultado as { resultados?: Fuente[] }).resultados ?? []) {
          recuperadas.set(normalizar(citaDe(r.documento, r.seccion)), { documento: r.documento, seccion: r.seccion });
        }
      }
      if (HERRAMIENTAS_DE_DATOS.has(llamada.nombre)) consultoDatos = true;
      mensajes.push({ rol: "herramienta", llamadaId: llamada.id, contenido: JSON.stringify(resultado) });
    }
  }
  // Después de 4 pasos el modelo sigue pidiendo herramientas: no hay una respuesta con fundamento
  return noSe(MAXIMO_PASOS, "maximo_pasos");
}
