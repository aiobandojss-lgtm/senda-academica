import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Un solo servidor de desarrollo: React (web/) con recarga en caliente y el Worker (api/)
// corriendo en workerd, el mismo runtime de producción. El plugin de Cloudflare lee
// wrangler.jsonc: las rutas /api/* van al Worker y el resto a los archivos de React.
//
// Bindings remotos: Workers AI no tiene simulador local, así que `npm run dev` abre una sesión con Cloudflare
// (requiere `wrangler login`). La prueba E2E no la necesita y en el CI no hay credenciales: Playwright arranca
// `vite preview` con CLOUDFLARE_VITE_FORCE_LOCAL=true (playwright.config.ts). Es el mismo nombre que las
// versiones nuevas del plugin leen por sí mismas; la 1.69 instalada solo entiende la opción `remoteBindings`.
const soloLocal = process.env.CLOUDFLARE_VITE_FORCE_LOCAL === "true";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: !soloLocal })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./web/src", import.meta.url)),
    },
  },
});
