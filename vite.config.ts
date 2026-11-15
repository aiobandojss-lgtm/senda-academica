import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Un solo servidor de desarrollo: React (web/) con recarga en caliente y el Worker (api/)
// corriendo en workerd, el mismo runtime de producción. El plugin de Cloudflare lee
// wrangler.jsonc: las rutas /api/* van al Worker y el resto a los archivos de React.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./web/src", import.meta.url)),
    },
  },
});
