// Tipos compartidos por la API

// Igual que el CHECK de usuarios.rol en migrations/0001_inicial.sql
export const ROLES = ["admin", "docente", "estudiante"] as const;
export type Rol = (typeof ROLES)[number];

// Usuario de la sesión actual, leído de la base en cada petición. Lo deja requiereSesion
// (seguridad/permisos.ts) en c.var.usuario; en las rutas públicas no existe.
export type UsuarioSesion = {
  id: number;
  rol: Rol;
  nombres: string;
  apellidos: string;
  // Compuertas de primer ingreso (D16)
  debeCambiarPassword: boolean;
  debeAceptarAviso: boolean;
};

// Lo que Hono conoce de cada petición: los bindings y variables de wrangler.jsonc (Env lo genera
// `npm run cf-typegen`) y las variables que dejan los middlewares
export type AppEnv = { Bindings: Env; Variables: { usuario: UsuarioSesion } };
