import type { FullConfig } from "@playwright/test";
import { execSync } from "node:child_process";

// Antes de la prueba E2E: la D1 y el KV locales quedan en un estado conocido. En CI la base local empieza
// vacía (de ahí las migraciones); en tu equipo, el seed deshace lo que cambió la corrida anterior.
// Solo toca la base LOCAL: las operaciones remotas no tienen script a propósito (CLAUDE.md).

// El seed usa la fecha de referencia 2026-11-20 y la mora se calcula con la fecha REAL del servidor: los
// estados de cartera que espera la prueba (Manuela bloqueada; al pagar octubre, "en riesgo") solo se cumplen
// en esta ventana (verificada con SQL al generar el seed). Fuera de ella la prueba fallaría con un mensaje
// confuso; mejor fallar aquí con uno claro. Pendiente para después de la presentación: seed relativo a hoy.
const VENTANA = { desde: "2026-11-06", hasta: "2026-11-29" };

// Cuenta de administrador del seed (db/seed/CUENTAS-DEMO.md, datos ficticios), la misma de e2e/demo.spec.ts
const ADMIN = { documento: "9900000001", contrasena: "Demo2026*" };

export default function preparar(config: FullConfig) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  if (hoy < VENTANA.desde || hoy > VENTANA.hasta) {
    throw new Error(
      `La prueba E2E usa el seed de la demo, válido del ${VENTANA.desde} al ${VENTANA.hasta}, y hoy es ${hoy} en Colombia. ` +
        "Hay que generar el seed con una fecha de referencia relativa a hoy y ajustar las fechas que compara e2e/demo.spec.ts.",
    );
  }
  execSync("npm run db:migrate", { stdio: "inherit" });
  execSync("npm run db:seed", { stdio: "inherit" });
  cargarDocumentosDelAsistente(config);
}

// Los documentos del asistente no son parte del seed (los carga npm run rag:indexar), y en el CI la base empieza vacía.
// Se cargan por la API, por el mismo camino real de ingesta, con el servidor de la prueba ya arriba (Playwright lo
// arranca antes de este paso) y el modo simulado, sin Workers AI ni Vectorize (RAG tarea 4.2).
// En tu equipo ya están cargados para npm run dev y se dejan como están: reemplazarlos cambiaría los ids de los
// fragmentos, y los vectores del espacio "local" de Vectorize quedarían apuntando a ids que ya no existen.
function cargarDocumentosDelAsistente(config: FullConfig) {
  const consulta = "SELECT count(*) AS documentos FROM documentos";
  const salida = execSync(`npx wrangler d1 execute DB --local --json --command "${consulta}"`, { encoding: "utf8" });
  const [{ results }] = JSON.parse(salida) as { results: { documentos: number }[] }[];
  if (results[0].documentos > 0) return;
  execSync(`npm run rag:indexar -- --url ${config.projects[0].use.baseURL}`, {
    stdio: "inherit",
    env: { ...process.env, SENDA_ADMIN_DOCUMENTO: ADMIN.documento, SENDA_ADMIN_CONTRASENA: ADMIN.contrasena },
  });
}
