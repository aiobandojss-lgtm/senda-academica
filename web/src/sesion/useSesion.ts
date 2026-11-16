import { createContext, useContext, useEffect } from "react";
import type { ConfigPublica, Perfil } from "@/lib/api";

export type ValorSesion = {
  config: ConfigPublica;
  perfil: Perfil | null;
  // Mensaje para la pantalla de ingreso: por qué terminó la sesión anterior
  avisoIngreso: string | null;
  ingresar: (documento: string, contrasena: string) => Promise<Perfil>;
  salir: (motivo?: string) => Promise<void>;
  actualizarPerfil: (perfil: Perfil) => void;
};

// Lo llena ProveedorSesion (ContextoSesion.tsx)
export const ContextoSesion = createContext<ValorSesion | null>(null);

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  return valor;
}

// Título de la pestaña por pantalla (WCAG 2.4.2): en una SPA no cambia solo al navegar
export function useTituloPagina(titulo: string) {
  const { config } = useSesion();
  useEffect(() => {
    document.title = `${titulo} · ${config.productoNombre}`;
  }, [titulo, config.productoNombre]);
}
