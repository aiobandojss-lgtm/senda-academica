import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Pruebas de la API: corren dentro de workerd, el mismo runtime de producción.
// Vitest usa este archivo en lugar de vite.config.ts, así que aquí no se cargan React ni Tailwind.
export default defineConfig({
  plugins: [
    cloudflareTest({
      // Toma el Worker, los bindings y las variables de wrangler.jsonc
      wrangler: { configPath: "./wrangler.jsonc" },
      // D1 y KV siempre locales y efímeros: las pruebas nunca tocan los datos reales en Cloudflare
      // y el CI no necesita credenciales para correrlas
      remoteBindings: false,
    }),
  ],
  test: {
    include: ["api/test/**/*.test.ts"],
  },
});
