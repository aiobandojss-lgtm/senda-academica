// Pruebas de los hooks de Senda: node .claude/hooks/probar-hooks.mjs
// Le pasa a cada hook la misma entrada JSON que le daría Claude Code y verifica su código de salida: 2 bloquea (o
// avisa, en el PostToolUse) y 0 deja pasar. No usa Vitest porque las pruebas de Vitest corren en workerd, sin procesos.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const SECRETOS = ".dev.vars";

function correr(hook, entrada) {
  const r = spawnSync(process.execPath, [path.join(AQUI, hook)], {
    input: typeof entrada === "string" ? entrada : JSON.stringify(entrada),
    env: { ...process.env, CLAUDE_PROJECT_DIR: RAIZ },
    encoding: "utf8",
  });
  return { codigo: r.status, mensaje: r.stderr };
}

const guardian = (tool_name, tool_input) => correr("guardian-reglas.mjs", { tool_name, tool_input, cwd: RAIZ });

const CASOS_GUARDIAN = [
  ["leer .dev.vars", guardian("Read", { file_path: path.join(RAIZ, SECRETOS) }), 2],
  ["leer la copia de .dev.vars del build", guardian("Read", { file_path: path.join(RAIZ, "dist", "senda", SECRETOS) }), 2],
  ["leer la plantilla .dev.vars.example", guardian("Read", { file_path: path.join(RAIZ, `${SECRETOS}.example`) }), 0],
  ["editar .dev.vars", guardian("Edit", { file_path: path.join(RAIZ, SECRETOS) }), 2],
  ["buscar con Grep dentro de .dev.vars", guardian("Grep", { pattern: "JWT", path: path.join(RAIZ, SECRETOS) }), 2],
  ["cat .dev.vars en Bash", guardian("Bash", { command: `cat ${SECRETOS}` }), 2],
  ["grep sobre .dev.vars en Bash", guardian("Bash", { command: `grep -c "^MODELO_CHAT" ${SECRETOS}` }), 2],
  ["cat de la plantilla en Bash", guardian("Bash", { command: `cat ${SECRETOS}.example` }), 0],
  ["commit con -m que menciona .dev.vars", guardian("Bash", { command: `git commit -m "Proteger ${SECRETOS} con el guardián"` }), 0],
  ["commit con heredoc que menciona .dev.vars", guardian("Bash", { command: `git commit -q -F - <<'EOF'\nEl guardián bloquea ${SECRETOS}\nEOF\ngit log -1` }), 0],
  ["un cat escondido después del heredoc", guardian("Bash", { command: `git commit -F - <<'EOF'\nmensaje\nEOF\ncat ${SECRETOS}` }), 2],
  ["editar una migración ya versionada", guardian("Edit", { file_path: path.join(RAIZ, "migrations", "0001_inicial.sql") }), 2],
  ["escribir una migración nueva", guardian("Write", { file_path: path.join(RAIZ, "migrations", "0099_nueva.sql") }), 0],
  ["editar código normal", guardian("Edit", { file_path: path.join(RAIZ, "api", "src", "index.ts") }), 0],
  ["un comando normal", guardian("Bash", { command: "npm test" }), 0],
  ["una entrada que no es JSON", correr("guardian-reglas.mjs", "no es json"), 0],
];

const temporal = mkdtempSync(path.join(tmpdir(), "senda-hooks-"));
const conTexto = (nombre, texto) => {
  const archivo = path.join(temporal, nombre);
  writeFileSync(archivo, texto, "utf8");
  return correr("caracteres-invisibles.mjs", { tool_name: "Write", tool_input: { file_path: archivo } });
};
const nbsp = String.fromCodePoint(0x00a0);
const bom = String.fromCodePoint(0xfeff);
const tildeSuelta = String.fromCodePoint(0x0301);

const CASOS_DETECTOR = [
  ["un espacio duro en el código", conTexto("a.ts", `const precio = "$360${nbsp}000";\n`), 2],
  ["una marca BOM al inicio", conTexto("b.md", `${bom}# Título\n`), 2],
  ["una tilde suelta (e + tilde)", conTexto("c.ts", `const nombre = "Jose${tildeSuelta}";\n`), 2],
  ["texto en español normal, con tildes y eñes", conTexto("d.md", "La contraseña del año: está bien.\n"), 0],
  ["un archivo que no es de texto", conTexto("e.png", `${nbsp}`), 0],
  ["un archivo que no existe", correr("caracteres-invisibles.mjs", { tool_name: "Write", tool_input: { file_path: path.join(temporal, "no-existe.ts") } }), 0],
];
const conUbicacion = conTexto("f.ts", `linea uno\nconst x = 1;${nbsp}\n`);
rmSync(temporal, { recursive: true, force: true });

let fallas = 0;
for (const [grupo, casos] of [["Guardián de reglas (PreToolUse)", CASOS_GUARDIAN], ["Caracteres invisibles (PostToolUse)", CASOS_DETECTOR]]) {
  console.log(grupo);
  for (const [nombre, { codigo }, esperado] of casos) {
    const bien = codigo === esperado;
    if (!bien) fallas++;
    console.log(`  ${bien ? "✓" : "✗"} ${nombre}: sale con ${codigo}${bien ? "" : `, se esperaba ${esperado}`}`);
  }
}
const ubicacionBien = conUbicacion.codigo === 2 && conUbicacion.mensaje.includes("línea 2, columna 13");
if (!ubicacionBien) fallas++;
console.log(`  ${ubicacionBien ? "✓" : "✗"} el aviso dice la línea y la columna`);

console.log(fallas === 0 ? "\nTodas las pruebas de los hooks pasan." : `\n${fallas} prueba(s) fallaron.`);
process.exitCode = fallas === 0 ? 0 : 1;
