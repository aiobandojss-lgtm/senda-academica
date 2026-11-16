import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Pruebas de la API: corren dentro de workerd, el mismo runtime de producción.
// Vitest usa este archivo en lugar de vite.config.ts, así que aquí no se cargan React ni Tailwind.

// Clave fija y pública, solo para pruebas: no es un secreto ni se parece al de Cloudflare.
// Se usa la misma en tu equipo y en el CI, sin importar lo que tenga tu .dev.vars.
const JWT_SECRET_PRUEBAS = "clave-de-pruebas-publica-no-usar-en-ningun-otro-lado";

// Wrangler revisa `secrets.required` al leer wrangler.jsonc: si existe .dev.vars usa solo ese archivo;
// si no (como en el CI), busca en .env y en process.env. Ponerla aquí evita en el CI una advertencia
// falsa de "secreto faltante". El valor que reciben las pruebas lo fija `miniflare.bindings`, más abajo.
process.env.JWT_SECRET ??= JWT_SECRET_PRUEBAS;

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      // Toma el Worker, los bindings y las variables de wrangler.jsonc
      wrangler: { configPath: "./wrangler.jsonc" },
      // D1 y KV siempre locales y efímeros: las pruebas nunca tocan los datos reales en Cloudflare
      // y el CI no necesita credenciales para correrlas
      remoteBindings: false,
      miniflare: {
        bindings: {
          // Las migraciones reales (migrations/*.sql), leídas aquí en Node; api/test/aplicar-migraciones.ts
          // las aplica a la D1 de cada archivo de pruebas
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          // Se impone sobre el valor de .dev.vars
          JWT_SECRET: JWT_SECRET_PRUEBAS,
        },
      },
    })),
  ],
  test: {
    include: ["api/test/**/*.test.ts"],
    setupFiles: ["./api/test/aplicar-migraciones.ts"],
  },
});
