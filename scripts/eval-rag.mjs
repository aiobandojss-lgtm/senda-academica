// Evaluación del asistente Senda contra el modelo real (tarea RAG 4.1; RAG design.md D7).
//
//   npm run eval:rag                                     -> todos los casos de eval/preguntas.json contra npm run dev
//   npm run eval:rag -- --casos nota-minima,cafeteria    -> solo esos casos (para repetir una falla sin gastar de más)
//   npm run eval:rag -- --modelo <modelo>                -> nombre del modelo para el reporte (ver abajo)
//   npm run eval:rag -- --recalificar eval/resultados/<reporte>.json
//       -> vuelve a calificar las respuestas guardadas en un reporte con las reglas actuales de eval/preguntas.json,
//          sin preguntarle otra vez al modelo (no gasta cuota). Sirve cuando se corrige una regla del calificador:
//          el reporte original no se toca y el nuevo termina en "-recalificado"
//
// Hace cada pregunta por la API, igual que la estudiante desde la pantalla, y califica la respuesta con reglas fijas
// (eval/calificar.ts). Antes de cada caso borra la conversación, para que una pregunta no influya en la siguiente.
// Entra con SENDA_ESTUDIANTE_DOCUMENTO y SENDA_ESTUDIANTE_CONTRASENA, o los pide en la terminal.
//
// - Gasta cuota real de Workers AI: por eso se corre a mano y no en el CI.
// - Cuenta para el límite de 30 preguntas diarias de la estudiante: para repetirla el mismo día, recarga el seed local
//   (npm run db:seed), que además deja sus datos como esperan los casos.
// - El modelo lo decide el servidor: MODELO_CHAT de wrangler.jsonc, o el que se le pase a npm run dev con la variable
//   MODELO_CHAT (vite.config.ts). El reporte usa --modelo, o esa misma variable, o el de wrangler.jsonc: debe ser el
//   mismo con el que arrancó el servidor.
// - Guarda el reporte en eval/resultados/. Los costos en neuronas se calculan con los tokens del registro "Asistente
//   respondió" de la terminal de npm run dev.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { calificar, resumir } from "../eval/calificar.ts";
import { crearApi, ingresar } from "./comun.mjs";

const { values: opciones } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:5173" },
    casos: { type: "string" },
    modelo: { type: "string" },
    recalificar: { type: "string" },
  },
});
const URL_BASE = opciones.url.replace(/\/+$/, "");
const api = crearApi(URL_BASE);

const evaluacion = JSON.parse(readFileSync("eval/preguntas.json", "utf8"));
const modeloDeWrangler = /"MODELO_CHAT":\s*"([^"]+)"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1];
const MODELO = opciones.modelo || process.env.MODELO_CHAT || modeloDeWrangler || "desconocido";

// Errores que detienen la evaluación: seguir solo gastaría cuota sin medir nada
const DETENER = {
  ASISTENTE_NO_DISPONIBLE: "El asistente no está disponible: ¿se agotó la cuota diaria de Workers AI o falló el servicio?",
  LIMITE_DIARIO: "La estudiante llegó al límite de preguntas de hoy. Recarga el seed local con npm run db:seed.",
};

const segundos = (ms) => `${(ms / 1000).toFixed(1)} s`;

function elegirCasos() {
  if (!opciones.casos) return evaluacion.casos;
  const ids = opciones.casos.split(",").map((id) => id.trim());
  const desconocidos = ids.filter((id) => !evaluacion.casos.some((c) => c.id === id));
  if (desconocidos.length > 0) throw new Error(`No existen los casos: ${desconocidos.join(", ")}`);
  return evaluacion.casos.filter((c) => ids.includes(c.id));
}

// Pregunta cada caso al asistente real y lo califica
async function evaluarEnVivo() {
  const casos = elegirCasos();
  const preguntasNecesarias = casos.reduce((total, c) => total + 1 + (c.previas?.length ?? 0), 0);

  console.log(`Servidor: ${URL_BASE}`);
  console.log(`Modelo del reporte: ${MODELO} (debe ser el mismo con el que arrancó npm run dev)`);
  const { cookie, perfil } = await ingresar(api, {
    rol: "estudiante",
    etiqueta: "estudiante",
    variableDocumento: "SENDA_ESTUDIANTE_DOCUMENTO",
    variableContrasena: "SENDA_ESTUDIANTE_CONTRASENA",
  });
  // Las respuestas esperadas son las de una estudiante concreta del seed
  if (perfil.nombres !== evaluacion.estudiante) {
    throw new Error(`Los casos esperan los datos de ${evaluacion.estudiante}, la estudiante al día del seed, y entraste como otra persona`);
  }
  const { datos: conversacion } = await api("GET", "/asistente/mensajes", { cookie });
  if (conversacion.preguntasRestantes < preguntasNecesarias) {
    throw new Error(`Hacen falta ${preguntasNecesarias} preguntas y a la estudiante le quedan ${conversacion.preguntasRestantes} hoy. ${DETENER.LIMITE_DIARIO}`);
  }
  console.log(`${casos.length} casos, ${preguntasNecesarias} preguntas\n`);

  const resultados = [];
  for (const caso of casos) {
    await api("DELETE", "/asistente/mensajes", { cookie });
    let respuesta;
    let milisegundos = 0;
    try {
      for (const previa of caso.previas ?? []) await api("POST", "/asistente/mensajes", { cookie, cuerpo: { pregunta: previa } });
      const inicio = performance.now();
      ({ datos: respuesta } = await api("POST", "/asistente/mensajes", { cookie, cuerpo: { pregunta: caso.pregunta } }));
      milisegundos = performance.now() - inicio;
    } catch (error) {
      if (DETENER[error.codigo]) {
        console.error(`\nSe detuvo en el caso ${caso.id}: ${DETENER[error.codigo]}`);
        process.exitCode = 1;
        break;
      }
      respuesta = { respuesta: `(error de la API: ${error.message})`, fuentes: [] };
    }

    const calificacion = calificar(caso, respuesta);
    resultados.push({ caso, calificacion, respuesta, milisegundos });
    const marca = calificacion.acierto ? "✓" : "✗";
    console.log(`${marca} ${caso.id} (${segundos(milisegundos)})${calificacion.acierto ? "" : `: ${calificacion.fallas.join("; ")}`}`);
  }
  // La conversación de la estudiante queda vacía, como antes de evaluar
  await api("DELETE", "/asistente/mensajes", { cookie });
  reportar(resultados, { modelo: MODELO, servidor: URL_BASE, sufijo: "" });
}

// Califica otra vez las respuestas de un reporte guardado, con las reglas actuales (sin llamar al modelo)
function recalificar(archivo) {
  const anterior = JSON.parse(readFileSync(archivo, "utf8"));
  const resultados = anterior.casos.map((guardado) => {
    const caso = evaluacion.casos.find((c) => c.id === guardado.id);
    if (!caso) throw new Error(`El caso ${guardado.id} ya no existe en eval/preguntas.json`);
    const respuesta = { respuesta: guardado.respuesta, fuentes: guardado.fuentes };
    return { caso, calificacion: calificar(caso, respuesta), respuesta, milisegundos: guardado.ms };
  });
  console.log(`Recalificando ${archivo} (${anterior.modelo}, ${anterior.fecha}) con las reglas actuales\n`);
  for (const r of resultados) console.log(`${r.calificacion.acierto ? "✓" : "✗"} ${r.caso.id}${r.calificacion.acierto ? "" : `: ${r.calificacion.fallas.join("; ")}`}`);
  reportar(resultados, { modelo: anterior.modelo, servidor: anterior.servidor, sufijo: "-recalificado", fecha: anterior.fecha });
}

function reportar(resultados, { modelo, servidor, sufijo, fecha = new Date().toISOString() }) {
  if (resultados.length === 0) return;
  const resumen = resumir(resultados);
  const tiempos = resultados.map((r) => r.milisegundos).sort((a, b) => a - b);
  const mediana = tiempos[Math.floor(tiempos.length / 2)];
  const completa = resultados.length === evaluacion.casos.length;

  console.log("\nRespuestas con fallas:");
  for (const r of resultados.filter((r) => !r.calificacion.acierto)) {
    console.log(`\n[${r.caso.id}] ${r.caso.pregunta}\n${r.respuesta.respuesta}`);
    if (r.respuesta.fuentes.length > 0) console.log(`Fuentes: ${r.respuesta.fuentes.map((f) => `${f.documento} – ${f.seccion}`).join("; ")}`);
  }

  console.log(`\nModelo: ${modelo}${completa ? "" : " (evaluación parcial: no cuenta para elegir el modelo)"}`);
  console.table(Object.fromEntries(Object.entries(resumen.porCategoria).filter(([, c]) => c.total > 0).map(([nombre, c]) => [nombre, { ...c }])));
  console.log(`Citas correctas: ${resumen.citas.correctas} de ${resumen.citas.total}`);
  console.log(`Negaciones correctas: ${resumen.negaciones.correctas} de ${resumen.negaciones.total}`);
  console.log(`Tiempo por respuesta: mediana ${segundos(mediana)}, máximo ${segundos(tiempos.at(-1))}`);
  console.log(`Aciertos: ${resumen.aciertos} de ${resumen.total} (${resumen.porcentaje} %). Umbral: ${evaluacion.umbral} %`);

  // El reporte queda en el repositorio como evidencia: son datos ficticios del seed
  const carpeta = "eval/resultados";
  mkdirSync(carpeta, { recursive: true });
  const prefijo = fecha.slice(0, 16).replace(":", "");
  const archivo = join(carpeta, `${prefijo}-${modelo.split("/").at(-1)}${completa ? "" : "-parcial"}${sufijo}.json`);
  const reporte = {
    fecha,
    ...(sufijo ? { recalificado: new Date().toISOString() } : {}),
    servidor,
    modelo,
    completa,
    resumen,
    tiempos: { medianaMs: Math.round(mediana), maximoMs: Math.round(tiempos.at(-1)) },
    casos: resultados.map((r) => ({
      id: r.caso.id,
      categoria: r.caso.categoria,
      pregunta: r.caso.pregunta,
      respuesta: r.respuesta.respuesta,
      fuentes: r.respuesta.fuentes,
      acierto: r.calificacion.acierto,
      fallas: r.calificacion.fallas,
      ms: Math.round(r.milisegundos),
    })),
  };
  writeFileSync(archivo, `${JSON.stringify(reporte, null, 2)}\n`);
  console.log(`Reporte: ${archivo}`);
  if (resumen.porcentaje < evaluacion.umbral) process.exitCode = 1;
}

(async () => (opciones.recalificar ? recalificar(opciones.recalificar) : evaluarEnVivo()))().catch((error) => {
  console.error(`No se pudo evaluar: ${error.message}${error.codigo ? ` [${error.codigo}]` : ""}`);
  process.exitCode = 1;
});
