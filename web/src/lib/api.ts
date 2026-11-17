// Cliente de la API de Senda. Todo dato que muestra la interfaz sale de aquí (criterio 2 de la rúbrica):
// nada de datos quemados en el frontend.

export type Rol = "admin" | "docente" | "estudiante";

// GET /api/config/publica (design.md D19)
export type ConfigPublica = {
  productoNombre: string;
  fundacionNombre: string;
  contactoFundacion: string;
  avisoPrivacidadVersion: string;
};

// Perfil que devuelven /auth/ingresar, /auth/yo, /auth/contrasena y /auth/aviso (api/src/rutas/auth.ts)
export type Perfil = {
  id: number;
  rol: Rol;
  nombres: string;
  apellidos: string;
  debeCambiarPassword: boolean;
  debeAceptarAviso: boolean;
};

// Un error de una fila de la carga masiva por CSV (tarea 3.3)
export type ErrorFila = { fila: number; campo?: string; mensaje: string };

// Error con el formato de la API, { codigo, mensaje } (api/src/errores.ts). El mensaje ya viene en
// español y listo para mostrar; el código sirve para decidir qué hacer. En errores de validación,
// `campo` dice qué dato está mal; la carga por CSV trae además la lista de `errores` por fila.
export class ErrorApi extends Error {
  readonly codigo: string;
  readonly estado: number;
  readonly campo?: string;
  readonly errores?: ErrorFila[];

  constructor(estado: number, codigo: string, mensaje: string, extra: { campo?: string; errores?: ErrorFila[] } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
    this.campo = extra.campo;
    this.errores = extra.errores;
  }
}

// El contexto de sesión se registra aquí para enterarse cuando la API responde 401 (sesión vencida o
// revocada) o 403 por una compuerta de primer ingreso (D16), venga de la pantalla que venga
type Oyente = (error: ErrorApi) => void;
let oyenteDeSesion: Oyente | null = null;
export function escucharErroresDeSesion(oyente: Oyente | null) {
  oyenteDeSesion = oyente;
}

const CODIGOS_DE_SESION = new Set(["NO_AUTENTICADO", "DEBE_CAMBIAR_PASSWORD", "DEBE_ACEPTAR_AVISO"]);

// FormData: el navegador pone el Content-Type multipart con su separador; no se escribe a mano
type Cuerpo = { json: unknown } | { texto: string; tipo: string } | { formulario: FormData };

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const encabezados = (cuerpo?: Cuerpo) =>
  cuerpo === undefined || "formulario" in cuerpo ? undefined : { "Content-Type": "json" in cuerpo ? "application/json" : cuerpo.tipo };
const contenido = (cuerpo?: Cuerpo) =>
  cuerpo === undefined ? undefined : "json" in cuerpo ? JSON.stringify(cuerpo.json) : "texto" in cuerpo ? cuerpo.texto : cuerpo.formulario;

async function pedir<T>(metodo: Metodo, ruta: string, cuerpo?: Cuerpo): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      // La sesión viaja en la cookie __Host-sesion (HttpOnly): JavaScript nunca la lee ni la guarda
      credentials: "same-origin",
      headers: encabezados(cuerpo),
      body: contenido(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", "No hay conexión. Revisa tu internet e intenta de nuevo");
  }

  const datos: unknown = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos as T;

  const { codigo, mensaje, campo, errores } = (datos ?? {}) as { codigo?: string; mensaje?: string; campo?: string; errores?: ErrorFila[] };
  const error = new ErrorApi(
    respuesta.status,
    codigo ?? "ERROR_INESPERADO",
    mensaje ?? "Ocurrió un error inesperado. Intenta de nuevo en unos minutos",
    { campo, errores },
  );
  if (CODIGOS_DE_SESION.has(error.codigo)) oyenteDeSesion?.(error);
  throw error;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>("GET", ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>("POST", ruta, cuerpo === undefined ? undefined : { json: cuerpo }),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>("PATCH", ruta, { json: cuerpo }),
  // Texto plano, como el CSV de la carga masiva
  postTexto: <T>(ruta: string, texto: string, tipo: string) => pedir<T>("POST", ruta, { texto, tipo }),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>("PUT", ruta, { json: cuerpo }),
  delete: <T>(ruta: string) => pedir<T>("DELETE", ruta),
  // Archivos: multipart/form-data con el campo "archivo" (entregas y archivos de apoyo)
  subirArchivo: <T>(metodo: "POST" | "PUT", ruta: string, archivo: File) => {
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    return pedir<T>(metodo, ruta, { formulario });
  },
};
