import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { responderError } from "./errores";
import { auth } from "./rutas/auth";
import type { AppEnv } from "./tipos";

// API de Senda. Todas las rutas cuelgan de /api: en wrangler.jsonc, run_worker_first
// envía solo /api/* al Worker; el resto lo sirven los archivos estáticos de React.
const app = new Hono<AppEnv>().basePath("/api");

// Verificación de vida: la usan el CI, el monitoreo y la página inicial
app.get("/salud", (c) => c.json({ ok: true }));

app.route("/auth", auth);

app.onError((error, c) => {
  // Errores de la solicitud que detecta Hono, como un JSON mal formado
  if (error instanceof HTTPException && error.status === 400) {
    return responderError(c, 400, "SOLICITUD_INVALIDA", "La solicitud no es válida");
  }
  if (error instanceof HTTPException) return error.getResponse();

  // Habeas Data: solo la ruta y el error, nunca el cuerpo de la petición (puede traer documento o contraseña)
  console.error("Error no controlado", { ruta: c.req.path, error: error.name, mensaje: error.message });
  return responderError(c, 500, "ERROR_INTERNO", "Ocurrió un error inesperado. Intenta de nuevo en unos minutos");
});

export default app;
