// Hook PostToolUse de Senda: detector de caracteres invisibles. Claude Code lo ejecuta después de cada Edit y Write
// del agente (.claude/settings.json) y le pasa la llamada en JSON por la entrada estándar.
//
// Por qué existe: en los días 3 y 6 los escapes Unicode que escribía el agente quedaron convertidos en el carácter
// real (un BOM, espacios duros y tildes sueltas dentro de una expresión regular). El código seguía funcionando, pero
// tenía caracteres que no se ven. Este hook revisa el archivo recién escrito y, si encuentra alguno, se lo dice al
// agente con su línea y columna (código de salida 2: el archivo ya se escribió, así que no bloquea nada).
//
// Los caracteres se identifican por su código numérico, no escritos en el archivo: si este script los tuviera
// literales, se reportaría a sí mismo. Pruebas: node .claude/hooks/probar-hooks.mjs

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOSPECHOSOS = new Map([
  [0x00a0, "espacio duro (U+00A0)"],
  [0x2007, "espacio de cifra (U+2007)"],
  [0x202f, "espacio duro angosto (U+202F)"],
  [0x200b, "espacio de ancho cero (U+200B)"],
  [0x200c, "separador de ancho cero (U+200C)"],
  [0x200d, "unión de ancho cero (U+200D)"],
  [0x2060, "unión de palabras (U+2060)"],
  [0xfeff, "marca BOM (U+FEFF)"],
]);
// Una marca diacrítica suelta (U+0300 a U+036F) es una tilde separada de su letra: el español usa letras ya compuestas
const esMarcaSuelta = (codigo) => codigo >= 0x0300 && codigo <= 0x036f;

const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".md", ".css", ".html", ".sql", ".yml", ".yaml", ".toml", ".txt"]);
const MAXIMO_BYTES = 2 * 1024 * 1024;
const MAXIMO_REPORTADOS = 10;

let entrada;
try {
  entrada = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const archivo = String(entrada.tool_input?.file_path ?? "");
if (!archivo || !EXTENSIONES.has(path.extname(archivo).toLowerCase()) || !existsSync(archivo) || statSync(archivo).size > MAXIMO_BYTES) {
  process.exit(0);
}

const hallazgos = [];
const lineas = readFileSync(archivo, "utf8").split("\n");
for (const [i, linea] of lineas.entries()) {
  let columna = 0;
  for (const caracter of linea) {
    columna++;
    const codigo = caracter.codePointAt(0);
    const nombre = SOSPECHOSOS.get(codigo) ?? (esMarcaSuelta(codigo) ? `tilde suelta (U+0${codigo.toString(16).toUpperCase()})` : null);
    if (nombre) hallazgos.push(`  línea ${i + 1}, columna ${columna}: ${nombre}`);
  }
}

if (hallazgos.length > 0) {
  const lista = hallazgos.slice(0, MAXIMO_REPORTADOS).join("\n");
  const resto = hallazgos.length > MAXIMO_REPORTADOS ? `\n  ... y ${hallazgos.length - MAXIMO_REPORTADOS} más` : "";
  process.stderr.write(
    `Aviso del detector de caracteres invisibles (.claude/hooks/caracteres-invisibles.mjs): ${path.basename(archivo)} quedó con ` +
      `${hallazgos.length} carácter(es) que no se ven:\n${lista}${resto}\n` +
      "Si no son intencionales, reemplázalos por el carácter normal. Si deben estar, escríbelos como escape Unicode " +
      "armado con código (por ejemplo, String.fromCharCode) para que el archivo no los tenga literales.\n",
  );
  process.exit(2);
}
process.exit(0);
