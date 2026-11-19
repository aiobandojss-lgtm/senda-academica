// Carga los documentos de docs/rag en la base de conocimiento del asistente, por la API (tarea RAG 2.3).
//
//   npm run rag:indexar                                    -> servidor local (npm run dev), espacio "local"
//   npm run rag:indexar -- --url https://senda.creativebycode.workers.dev   -> producción, espacio "produccion"
//
// Entra como administrador con SENDA_ADMIN_DOCUMENTO y SENDA_ADMIN_CONTRASENA, o los pide en la terminal (la contraseña
// no se muestra). Nunca se guardan ni se imprimen. Cada archivo .md es un documento: su clave es el nombre del archivo
// y su título, tipo y carrera salen del encabezado (front matter). Cargarlo otra vez lo reemplaza (PUT).
// Cada carga gasta cuota de Workers AI (embeddings, unas pocas neuronas por documento).

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { crearApi, ingresar } from "./comun.mjs";

const { values: opciones } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:5173" },
    carpeta: { type: "string", default: "docs/rag" },
  },
});
const URL_BASE = opciones.url.replace(/\/+$/, "");

// Encabezado entre dos líneas "---" al inicio del archivo: "clave: valor" por línea
function leerEncabezado(texto) {
  const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const encabezado = /^---\r?\n([\s\S]*?)\r?\n---/.exec(sinBom);
  if (!encabezado) return null;
  const datos = {};
  for (const linea of encabezado[1].split(/\r?\n/)) {
    const separador = linea.indexOf(":");
    if (separador > 0) datos[linea.slice(0, separador).trim()] = linea.slice(separador + 1).trim();
  }
  return datos;
}

const api = crearApi(URL_BASE);

async function principal() {
  const archivos = readdirSync(opciones.carpeta)
    .filter((archivo) => archivo.endsWith(".md"))
    .sort();
  if (archivos.length === 0) throw new Error(`No hay archivos .md en ${opciones.carpeta}`);

  console.log(`Servidor: ${URL_BASE}`);
  const { cookie } = await ingresar(api, {
    rol: "admin",
    etiqueta: "administrador",
    variableDocumento: "SENDA_ADMIN_DOCUMENTO",
    variableContrasena: "SENDA_ADMIN_CONTRASENA",
  });
  const { datos: carreras } = await api("GET", "/carreras", { cookie });
  const idPorCodigo = new Map(carreras.map((c) => [c.codigo, c.id]));

  let fallidos = 0;
  let espacio = "";
  for (const archivo of archivos) {
    const clave = basename(archivo, ".md");
    try {
      const contenido = readFileSync(join(opciones.carpeta, archivo), "utf8");
      const encabezado = leerEncabezado(contenido);
      if (!encabezado?.titulo || !encabezado.tipo) throw new Error("Falta el encabezado con titulo y tipo");
      const general = !encabezado.carrera || encabezado.carrera === "general";
      const carreraId = general ? null : idPorCodigo.get(encabezado.carrera);
      if (carreraId === undefined) throw new Error(`La carrera ${encabezado.carrera} no existe en ese servidor`);

      const { datos, respuesta } = await api("PUT", `/documentos/${clave}`, {
        cookie,
        cuerpo: { titulo: encabezado.titulo, tipo: encabezado.tipo, carreraId, contenido },
      });
      espacio = datos.espacio;
      const accion = respuesta.status === 201 ? "cargado" : "reemplazado";
      console.log(`  ✓ ${clave}: ${accion}, ${datos.documento.fragmentos} fragmentos (${general ? "general" : encabezado.carrera})`);
    } catch (error) {
      fallidos++;
      console.error(`  ✗ ${clave}: ${error.message}${error.codigo ? ` [${error.codigo}]` : ""}`);
    }
  }

  // Lo que quedó en la base, leído de la API: es lo que ve el administrador
  const { datos: documentos } = await api("GET", "/documentos", { cookie });
  console.log(`\nBase de conocimiento (espacio de Vectorize: ${espacio || "sin cambios"}):`);
  console.table(
    documentos.map((d) => ({ documento: d.clave, carrera: d.carrera?.codigo ?? "general", fragmentos: d.fragmentos })),
  );
  if (fallidos > 0) {
    console.error(`${fallidos} documento(s) no se cargaron.`);
    process.exitCode = 1;
  }
}

principal().catch((error) => {
  console.error(`No se pudo indexar: ${error.message}${error.codigo ? ` [${error.codigo}]` : ""}`);
  process.exitCode = 1;
});
