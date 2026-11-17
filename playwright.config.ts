import { defineConfig, devices } from "@playwright/test";

// Prueba E2E del flujo de la demo (tarea 6.1, criterio 4 de la rúbrica). Corre contra el BUILD DE PRODUCCIÓN
// (vite preview: el mismo Worker y el mismo frontend que se publican), no contra el servidor de desarrollo:
// así no hay recargas de Vite y se prueba lo que se despliega. La D1 y el KV son los locales, con el seed.
const PUERTO = 4173;

export default defineConfig({
  testDir: "e2e",
  // Base conocida antes de cada corrida: migraciones y seed (e2e/preparar.ts)
  globalSetup: "./e2e/preparar.ts",
  // El recorrido cambia datos (entrega, nota, pago): una sola prueba, en orden
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // Las personas de la demo están en Colombia: textos y fechas como los verían ellas
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "demo", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}/api/salud`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
