// Servidor local de las diapositivas de la presentación (docs/presentacion/diapositivas.html).
//
//   npm run presentacion        -> http://127.0.0.1:8765 (proyección) y http://127.0.0.1:8765/?vista=guion (guion)
//
// Por qué un servidor y no abrir el archivo con doble clic: Chrome bloquea las fuentes cargadas desde file://, y con un
// mismo origen las dos ventanas (proyección y guion) se sincronizan con BroadcastChannel. Funciona sin internet.
// Seguridad: escucha solo en 127.0.0.1 y sirve únicamente los archivos de docs/presentacion y las fuentes de la lista;
// nunca el resto del repositorio (ahí está .dev.vars).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const PUERTO = Number(process.env.PUERTO ?? 8765);
const RAIZ = resolve("docs/presentacion");

// Las mismas fuentes de Senda (docs/identidad-visual.md), desde los paquetes de Fontsource ya instalados
const FUENTES = {
  "/fuentes/fraunces.woff2": "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2",
  "/fuentes/fraunces-italica.woff2": "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2",
  "/fuentes/atkinson.woff2": "node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  "/fuentes/atkinson-italica.woff2":
    "node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-italic.woff2",
};

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function rutaDe(url) {
  const { pathname } = new URL(url, "http://127.0.0.1");
  if (pathname === "/") return resolve(RAIZ, "diapositivas.html");
  if (FUENTES[pathname]) return resolve(FUENTES[pathname]);
  const ruta = resolve(RAIZ, `.${decodeURIComponent(pathname)}`);
  // Nada fuera de docs/presentacion, aunque la ruta traiga ".."
  return ruta.startsWith(RAIZ + sep) ? ruta : null;
}

const servidor = createServer(async (peticion, respuesta) => {
  let ruta = null;
  try {
    ruta = rutaDe(peticion.url ?? "/");
  } catch {
    // Una dirección mal formada (por ejemplo, un % suelto) no tumba el servidor
  }
  const tipo = ruta ? TIPOS[extname(ruta)] : undefined;
  if (!ruta || !tipo) {
    respuesta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado");
    return;
  }
  try {
    const contenido = await readFile(ruta);
    respuesta.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-store" }).end(contenido);
  } catch {
    respuesta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado");
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log("Diapositivas de Senda, sin internet:");
  console.log(`  Proyección (pantalla compartida): http://127.0.0.1:${PUERTO}`);
  console.log(`  Guion (tu otra pantalla):        http://127.0.0.1:${PUERTO}/?vista=guion`);
  console.log(`  Glosario para estudiar:          http://127.0.0.1:${PUERTO}/glosario.html`);
  console.log("Teclas: → o espacio avanza, ← retrocede, F pantalla completa, T inicia o pausa el cronómetro. Ctrl+C para salir.");
});
