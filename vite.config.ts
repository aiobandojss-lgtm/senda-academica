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
// Para comparar modelos en desarrollo (tarea RAG 4.1): `MODELO_CHAT=<modelo> npm run dev` cambia el modelo del
// asistente solo en ese servidor, sin editar wrangler.jsonc. El build que se despliega siempre usa el de wrangler.jsonc
const modeloChat = process.env.MODELO_CHAT?.trim();
// Prueba E2E (tarea RAG 4.2): playwright.config.ts arranca el build con MODELO_SIMULADO=1 y el asistente usa el modelo
// y la búsqueda simulados, sin Workers AI ni Vectorize. El Worker lo ignora fuera de localhost (api/src/rag/simulado.ts)
const simulado = process.env.MODELO_SIMULADO === "1";

export default defineConfig(({ command, isPreview }) => {
  // Solo `npm run dev` (vite serve), no `vite build` ni `vite preview`. El índice Vectorize es el real, el mismo de
  // producción, así que el desarrollo trabaja en su propio espacio: RAG_ESPACIO=local (RAG design.md D2). Es
  // automático a propósito: si dependiera de editar .dev.vars, un olvido escribiría en el espacio de la demo.
  // El build que se despliega conserva "produccion" de wrangler.jsonc.
  const esDesarrollo = command === "serve" && !isPreview;
  if (esDesarrollo && modeloChat) console.log(`Modelo del asistente en este servidor: ${modeloChat} (variable MODELO_CHAT)`);
  if (simulado) console.log("MODELO_SIMULADO=1: el asistente usa el modelo simulado de la prueba E2E");

  // Variables que cambian en este comando; el build que se despliega no cambia ninguna
  const variables: Record<string, string> = {
    ...(esDesarrollo ? { RAG_ESPACIO: "local" } : {}),
    ...(esDesarrollo && modeloChat ? { MODELO_CHAT: modeloChat } : {}),
    ...(simulado ? { MODELO_SIMULADO: "1" } : {}),
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflare({
        remoteBindings: !soloLocal,
        ...(Object.keys(variables).length > 0 ? { config: (worker) => ({ vars: { ...worker.vars, ...variables } }) } : {}),
      }),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./web/src", import.meta.url)),
      },
    },
  };
});
