import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { responderError } from "./errores";
import { actividades, actividadesDeCurso } from "./rutas/actividades";
import { archivos } from "./rutas/archivos";
import { asistente } from "./rutas/asistente";
import { auth } from "./rutas/auth";
import { calificaciones } from "./rutas/calificaciones";
import { cargaEstudiantes } from "./rutas/carga";
import { carteraDeEstudiante, cuotas, estadoCuentaPropio, pagos, resumenCartera } from "./rutas/cartera";
import { carreras } from "./rutas/carreras";
import { config } from "./rutas/config";
import { cursos } from "./rutas/cursos";
import { docentes } from "./rutas/docentes";
import { documentos } from "./rutas/documentos";
import { archivosDeActividad } from "./rutas/entregas";
import { estudiantes } from "./rutas/estudiantes";
import { usuarios } from "./rutas/usuarios";
import { requiereSesion } from "./seguridad/permisos";
import type { AppEnv } from "./tipos";

// API de Senda. Todas las rutas cuelgan de /api: en wrangler.jsonc, run_worker_first
// envía solo /api/* al Worker; el resto lo sirven los archivos estáticos de React.
const app = new Hono<AppEnv>().basePath("/api");

// Negar por defecto: toda ruta de /api exige sesión, salvo las que se declaran aquí como públicas.
// Una ruta nueva que nadie agregue a esta lista queda cerrada, nunca abierta.
const RUTAS_PUBLICAS = [
  "GET /api/salud",
  "GET /api/config/publica", // D19: la pantalla de ingreso necesita los nombres antes de que haya sesión
  "POST /api/auth/ingresar",
  "POST /api/auth/salir",
];

// D16: lo único permitido mientras falte cambiar la contraseña temporal o aceptar el aviso de privacidad
// (salir ya es pública)
const RUTAS_SIN_COMPUERTAS = ["GET /api/auth/yo", "POST /api/auth/contrasena", "POST /api/auth/aviso"];

// Va antes de las rutas: Hono ejecuta middlewares y rutas en el orden en que se registran.
// Los permisos por rol se declaran en cada ruta con requiereRol (seguridad/permisos.ts).
app.use("*", requiereSesion({ publicas: RUTAS_PUBLICAS, sinCompuertas: RUTAS_SIN_COMPUERTAS }));

// Verificación de vida: la usan el CI, el monitoreo y la página inicial
app.get("/salud", (c) => c.json({ ok: true }));

app.route("/auth", auth);
app.route("/carreras", carreras);
app.route("/config", config);
app.route("/cursos", cursos);
// Actividades de un curso (/cursos/:id/actividades) y de una actividad (/actividades/:id), tarea 4.1
app.route("/cursos", actividadesDeCurso);
app.route("/actividades", actividades);
// Entrega del estudiante y archivo de apoyo de una actividad, tarea 4.2
app.route("/actividades", archivosDeActividad);
// Descarga protegida y calificación, tarea 4.3
app.route("/archivos", archivos);
app.route("/entregas", calificaciones);
app.route("/docentes", docentes);
// Plantilla y carga masiva por CSV (tarea 3.3), bajo el mismo prefijo que el resto de estudiantes
app.route("/estudiantes", cargaEstudiantes);
app.route("/estudiantes", estudiantes);
// Cartera: cuotas, pagos y estado de cuenta, tarea 5.2
app.route("/estudiantes", carteraDeEstudiante);
app.route("/cuotas", cuotas);
app.route("/pagos", pagos);
app.route("/estado-cuenta", estadoCuentaPropio);
app.route("/cartera", resumenCartera);
app.route("/usuarios", usuarios);
// Documentos oficiales del asistente (RAG tarea 2.2) y el asistente de los estudiantes (RAG tarea 3.3)
app.route("/documentos", documentos);
app.route("/asistente", asistente);

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
