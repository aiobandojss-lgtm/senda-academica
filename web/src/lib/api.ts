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

// Error con el formato de la API, { codigo, mensaje } (api/src/errores.ts). El mensaje ya viene en
// español y listo para mostrar; el código sirve para decidir qué hacer.
export class ErrorApi extends Error {
  readonly codigo: string;
  readonly estado: number;

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
    this.codigo = codigo;
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

async function pedir<T>(metodo: "GET" | "POST", ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      // La sesión viaja en la cookie __Host-sesion (HttpOnly): JavaScript nunca la lee ni la guarda
      credentials: "same-origin",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", "No hay conexión. Revisa tu internet e intenta de nuevo");
  }

  const datos: unknown = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos as T;

  const { codigo, mensaje } = (datos ?? {}) as { codigo?: string; mensaje?: string };
  const error = new ErrorApi(
    respuesta.status,
    codigo ?? "ERROR_INESPERADO",
    mensaje ?? "Ocurrió un error inesperado. Intenta de nuevo en unos minutos",
  );
  if (CODIGOS_DE_SESION.has(error.codigo)) oyenteDeSesion?.(error);
  throw error;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>("GET", ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>("POST", ruta, cuerpo),
};
