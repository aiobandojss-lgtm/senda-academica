import type { Perfil, Rol } from "@/lib/api";

// Rutas del frontend que dependen del estado de la sesión. Las compuertas de primer ingreso (D16)
// van fuera del layout por rol: mientras falten, la persona no ve el menú.
export const RUTAS = {
  ingresar: "/ingresar",
  cambiarContrasenaObligatorio: "/primer-ingreso/contrasena",
  aceptarAviso: "/primer-ingreso/aviso",
  cambiarContrasena: "/cuenta/contrasena",
} as const;

export const INICIO_POR_ROL: Record<Rol, string> = {
  admin: "/admin",
  docente: "/docente",
  estudiante: "/estudiante",
};

// Única regla de navegación: el mismo orden que aplica la API (permisos.ts). Si la persona intenta
// abrir una ruta que no le corresponde, las puertas la mandan aquí.
export function destinoDe(perfil: Perfil | null): string {
  if (!perfil) return RUTAS.ingresar;
  if (perfil.debeCambiarPassword) return RUTAS.cambiarContrasenaObligatorio;
  if (perfil.debeAceptarAviso) return RUTAS.aceptarAviso;
  return INICIO_POR_ROL[perfil.rol];
}

// La persona ya pasó las dos compuertas y puede usar la plataforma
export const sinCompuertas = (perfil: Perfil | null): perfil is Perfil =>
  !!perfil && !perfil.debeCambiarPassword && !perfil.debeAceptarAviso;
