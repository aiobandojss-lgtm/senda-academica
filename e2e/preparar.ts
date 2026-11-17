import { execSync } from "node:child_process";

// Antes de la prueba E2E: la D1 y el KV locales quedan en un estado conocido. En CI la base local empieza
// vacía (de ahí las migraciones); en tu equipo, el seed deshace lo que cambió la corrida anterior.
// Solo toca la base LOCAL: las operaciones remotas no tienen script a propósito (CLAUDE.md).

// El seed usa la fecha de referencia 2026-11-20 y la mora se calcula con la fecha REAL del servidor: los
// estados de cartera que espera la prueba (Manuela bloqueada; al pagar octubre, "en riesgo") solo se cumplen
// en esta ventana (verificada con SQL al generar el seed). Fuera de ella la prueba fallaría con un mensaje
// confuso; mejor fallar aquí con uno claro. Pendiente para después de la presentación: seed relativo a hoy.
const VENTANA = { desde: "2026-11-06", hasta: "2026-11-29" };

export default function preparar() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  if (hoy < VENTANA.desde || hoy > VENTANA.hasta) {
    throw new Error(
      `La prueba E2E usa el seed de la demo, válido del ${VENTANA.desde} al ${VENTANA.hasta}, y hoy es ${hoy} en Colombia. ` +
        "Hay que generar el seed con una fecha de referencia relativa a hoy y ajustar las fechas que compara e2e/demo.spec.ts.",
    );
  }
  execSync("npm run db:migrate", { stdio: "inherit" });
  execSync("npm run db:seed", { stdio: "inherit" });
}
