// Tipos compartidos por la API

// Lo que Hono conoce de cada petición: los bindings y variables de wrangler.jsonc (Env lo genera `npm run cf-typegen`)
export type AppEnv = { Bindings: Env };

// Igual que el CHECK de usuarios.rol en migrations/0001_inicial.sql
export const ROLES = ["admin", "docente", "estudiante"] as const;
export type Rol = (typeof ROLES)[number];
