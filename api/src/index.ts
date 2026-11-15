import { Hono } from "hono";

// API de Senda. Todas las rutas cuelgan de /api: en wrangler.jsonc, run_worker_first
// envía solo /api/* al Worker; el resto lo sirven los archivos estáticos de React.
const app = new Hono<{ Bindings: Env }>().basePath("/api");

// Verificación de vida: la usan el CI, el monitoreo y la página inicial
app.get("/salud", (c) => c.json({ ok: true }));

export default app;
