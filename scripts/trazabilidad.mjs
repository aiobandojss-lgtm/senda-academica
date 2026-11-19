// Trazabilidad entre las specs y las pruebas: cada escenario de openspec/specs/ debe tener al menos una prueba
// automática que lo verifique (Vitest o Playwright).
//
//   npm run trazabilidad               -> resumen por capacidad; falla si algún escenario no tiene prueba
//   npm run trazabilidad -- --detalle  -> además, qué prueba cubre cada escenario (archivo:línea)
//
// La convención: el nombre de la prueba empieza con el nombre del escenario, por ejemplo
//   it("Archivo demasiado grande: rechaza un archivo de más de 10 MB e indica el límite", ...)
// Una prueba que verifica dos escenarios los nombra a los dos: "Escenario A / Escenario B: ...".
// Se compara sin mayúsculas, tildes ni signos. Si dos capacidades tienen un escenario con el mismo nombre
// (por ejemplo, "Petición sin sesión"), hacen falta pruebas en archivos distintos, una por capacidad.
// Corre en el CI: un escenario nuevo sin su prueba no pasa.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values: opciones } = parseArgs({ options: { detalle: { type: "boolean", default: false } } });

const RAIZ_SPECS = "openspec/specs";
const CARPETAS_DE_PRUEBAS = ["api/test", "web/test", "eval", "e2e"];

const normalizar = (texto) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Escenarios: "#### Scenario: <nombre>" en la spec principal de cada capacidad
const escenarios = [];
for (const capacidad of readdirSync(RAIZ_SPECS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const texto = readFileSync(join(RAIZ_SPECS, capacidad, "spec.md"), "utf8");
  for (const m of texto.matchAll(/^#### Scenario: (.+)$/gm)) escenarios.push({ capacidad, nombre: m[1].trim() });
}

// Pruebas: los nombres de it(), test() y test.step() en los archivos *.test.ts y *.spec.ts
const archivos = [];
const recorrer = (carpeta) => {
  for (const e of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) recorrer(ruta);
    else if (/\.(test|spec)\.ts$/.test(e.name)) archivos.push(ruta);
  }
};
for (const carpeta of CARPETAS_DE_PRUEBAS) recorrer(carpeta);

const pruebas = [];
for (const archivo of archivos) {
  const texto = readFileSync(archivo, "utf8");
  for (const m of texto.matchAll(/\b(?:it|test|test\.step)\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    const linea = texto.slice(0, m.index).split("\n").length;
    pruebas.push({ archivo: relative(".", archivo).replaceAll("\\", "/"), linea, nombre: m[2], normalizado: normalizar(m[2]) });
  }
}

// Cuántas capacidades comparten cada nombre de escenario
const repeticiones = new Map();
for (const e of escenarios) repeticiones.set(normalizar(e.nombre), (repeticiones.get(normalizar(e.nombre)) ?? 0) + 1);

const resultados = escenarios.map((e) => {
  const buscado = normalizar(e.nombre);
  const cubren = pruebas.filter((p) => p.normalizado.includes(buscado));
  const archivosDistintos = new Set(cubren.map((p) => p.archivo)).size;
  return { ...e, cubren, cubierto: cubren.length > 0 && archivosDistintos >= repeticiones.get(buscado) };
});

const porCapacidad = new Map();
for (const r of resultados) {
  const c = porCapacidad.get(r.capacidad) ?? { capacidad: r.capacidad, escenarios: 0, conPrueba: 0 };
  c.escenarios++;
  if (r.cubierto) c.conPrueba++;
  porCapacidad.set(r.capacidad, c);
}

console.log(`Specs: ${RAIZ_SPECS} · pruebas: ${pruebas.length} en ${archivos.length} archivos\n`);
console.table(Object.fromEntries([...porCapacidad.values()].map((c) => [c.capacidad, { escenarios: c.escenarios, "con prueba": c.conPrueba }])));

if (opciones.detalle) {
  for (const r of resultados) {
    console.log(`\n[${r.capacidad}] ${r.nombre}`);
    for (const p of r.cubren) console.log(`   ${p.archivo}:${p.linea}  ${p.nombre.slice(0, 110)}`);
    if (!r.cubierto) console.log("   (sin prueba)");
  }
}

const faltan = resultados.filter((r) => !r.cubierto);
const total = resultados.length;
console.log(`\nEscenarios con prueba: ${total - faltan.length} de ${total}`);
if (faltan.length > 0) {
  console.error("\nSin prueba que lleve su nombre:");
  for (const r of faltan) console.error(`  [${r.capacidad}] ${r.nombre}`);
  process.exitCode = 1;
}
