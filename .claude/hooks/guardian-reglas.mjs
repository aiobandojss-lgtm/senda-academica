// Hook PreToolUse de Senda: el guardián de reglas. Claude Code lo ejecuta antes de cada Read, Edit, Write, Grep y
// Bash del agente (.claude/settings.json) y le pasa la llamada en JSON por la entrada estándar.
//
// Convierte dos reglas que no se negocian de CLAUDE.md en una barrera automática, que no depende de que el agente se
// acuerde de ellas:
//   1. Los secretos locales (.dev.vars) no se leen ni se editan: nunca deben pasar por el chat. La plantilla
//      .dev.vars.example sí se puede leer.
//   2. Las migraciones que ya están en git están congeladas: un cambio de esquema va en una migración nueva.
//
// Para bloquear sale con código 2 y escribe el motivo en stderr, que es lo que lee el agente. Si deja pasar, código 0.
// No es un sandbox: es una red contra descuidos, no contra un comando rebuscado (un comodín como .dev.v* lo esquiva).
// Por eso settings.json además niega con permissions.deny la lectura y la edición de .dev.vars.
// Pruebas: node .claude/hooks/probar-hooks.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const RUTA_SECRETOS = /(^|[\\/])\.dev\.vars$/;
const MENCION_SECRETOS = /\.dev\.vars(?!\.example)/;
const MOTIVO_SECRETOS =
  ".dev.vars tiene los secretos locales y no se lee ni se modifica desde el agente (CLAUDE.md, \"Secretos\"). Si necesitas saber qué variables espera, lee .dev.vars.example.";

// Búsquedas recursivas que leen todos los archivos de una carpeta, también .dev.vars y la copia que deja el build en
// dist/senda/, aunque el comando no los nombre: grep -r, -R o --recursive; findstr /s; rg cuando no respeta .gitignore
const BUSQUEDA_RECURSIVA = [
  /\bgrep\b[^|;&\n]*(?:\s-(?!-)[a-zA-Z]*[rR][a-zA-Z]*(?=\s|$)|\s--recursive\b|\s--directories=recurse\b)/,
  /\bfindstr\b[^|;&\n]*\s\/s\b/i,
  /\brg\b[^|;&\n]*\s(?:--no-ignore\b|--hidden\b|-u{1,3}(?=\s|$))/,
];

function bloquear(motivo) {
  process.stderr.write(`Bloqueado por el guardián de reglas (.claude/hooks/guardian-reglas.mjs): ${motivo}\n`);
  process.exit(2);
}

// Lo que no es el comando en sí: el mensaje de un git commit (con -m o en un heredoc) puede nombrar el archivo sin
// tocarlo. Solo se descuenta el heredoc que abre un git commit en su misma línea: el de cualquier otro comando
// (node <<'EOF' ... EOF) sí es código que se ejecuta
function sinMensajes(comando) {
  if (!/\bgit\s+commit\b/.test(comando)) return comando;
  return comando
    .replace(/(\bgit\s+commit\b[^\n]*?)<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\s*\2\s*(\n|$)/g, "$1\n")
    .replace(/\s-m\s+("(?:[^"\\]|\\.)*"|'[^']*')/g, " ");
}

function esMigracionVersionada(archivo, raiz) {
  const relativa = path.relative(raiz, path.resolve(raiz, archivo)).replaceAll("\\", "/");
  if (!/^migrations\/[^/]+\.sql$/.test(relativa)) return null;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", relativa], { cwd: raiz, stdio: "ignore" });
    return relativa;
  } catch {
    // No está en git: es una migración nueva que todavía se puede escribir
    return null;
  }
}

let entrada;
try {
  entrada = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const { tool_name: herramienta, tool_input: datos = {} } = entrada;
const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();

if (herramienta === "Bash") {
  const comando = sinMensajes(String(datos.command ?? ""));
  if (MENCION_SECRETOS.test(comando)) bloquear(MOTIVO_SECRETOS);
  if (BUSQUEDA_RECURSIVA.some((patron) => patron.test(comando))) {
    bloquear(
      "una búsqueda recursiva desde Bash también lee .dev.vars y su copia en dist/senda/, aunque no los nombre. Usa la herramienta Grep, que respeta .gitignore, o git grep, que solo busca en archivos versionados.",
    );
  }
  process.exit(0);
}

const archivo = String(datos.file_path ?? datos.path ?? "");
if (RUTA_SECRETOS.test(archivo)) bloquear(MOTIVO_SECRETOS);
if (herramienta === "Edit" || herramienta === "Write") {
  const migracion = esMigracionVersionada(archivo, raiz);
  if (migracion) {
    bloquear(`${migracion} ya está en git y las migraciones aplicadas están congeladas (CLAUDE.md, "No editar migraciones ya aplicadas"). Crea una migración nueva con el número siguiente.`);
  }
}
process.exit(0);
