import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PantallaCarga, PantallaSinConexion } from "@/components/marca/PantallaCarga";
import { api, type ConfigPublica, ErrorApi, escucharErroresDeSesion, type Perfil } from "@/lib/api";
import { clienteConsultas } from "@/lib/consultas";
import { type AvisoIngreso, ContextoSesion } from "./useSesion";

type Estado = { perfil: Perfil | null; avisoIngreso: AvisoIngreso | null };

// Carga la configuración pública y la sesión actual antes de mostrar cualquier pantalla. La sesión vive
// en la cookie HttpOnly; aquí solo se guarda el perfil que devuelve la API, nunca un token.
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigPublica | null>(null);
  const [estado, setEstado] = useState<Estado>({ perfil: null, avisoIngreso: null });
  const [carga, setCarga] = useState<"cargando" | "lista" | "sin_conexion">("cargando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    let suspendido: AvisoIngreso | null = null;
    // Sin sesión, /auth/yo responde 401: no es un error, es la pantalla de ingreso. Un estudiante bloqueado por
    // mora recibe 403 ACCESO_SUSPENDIDO: también va al ingreso, con el aviso de acceso suspendido.
    const sinSesion = (error: unknown) => {
      if (error instanceof ErrorApi && error.estado === 401) return null;
      if (error instanceof ErrorApi && error.codigo === "ACCESO_SUSPENDIDO") {
        suspendido = { mensaje: error.message, tipo: "suspendido" };
        return null;
      }
      throw error;
    };
    Promise.all([api.get<ConfigPublica>("/config/publica"), api.get<Perfil>("/auth/yo").catch(sinSesion)])
      .then(([configPublica, perfil]) => {
        if (!vigente) return;
        setConfig(configPublica);
        setEstado({ perfil, avisoIngreso: suspendido });
        setCarga("lista");
      })
      .catch(() => {
        if (vigente) setCarga("sin_conexion");
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  // Errores de sesión de cualquier pantalla (D4 y D16): las puertas de App.tsx redirigen solas
  useEffect(() => {
    escucharErroresDeSesion((error) => {
      // Bloqueado con la sesión abierta: se cierra la sesión (cookie) y vuelve al ingreso con el aviso
      if (error.codigo === "ACCESO_SUSPENDIDO") void api.post("/auth/salir").catch(() => undefined);
      setEstado((anterior) => {
        if (!anterior.perfil) return anterior;
        if (error.codigo === "NO_AUTENTICADO") return { perfil: null, avisoIngreso: { mensaje: error.message, tipo: "info" } };
        if (error.codigo === "ACCESO_SUSPENDIDO") return { perfil: null, avisoIngreso: { mensaje: error.message, tipo: "suspendido" } };
        if (error.codigo === "DEBE_CAMBIAR_PASSWORD") {
          return { ...anterior, perfil: { ...anterior.perfil, debeCambiarPassword: true } };
        }
        if (error.codigo === "DEBE_ACEPTAR_AVISO") {
          return { ...anterior, perfil: { ...anterior.perfil, debeAceptarAviso: true } };
        }
        return anterior;
      });
    });
    return () => escucharErroresDeSesion(null);
  }, []);

  useEffect(() => {
    if (config) document.title = config.productoNombre;
  }, [config]);

  // Sin sesión, la caché de datos se vacía: en un computador compartido, quien ingrese después no
  // puede encontrar en memoria los datos de la sesión anterior (Habeas Data)
  useEffect(() => {
    if (!estado.perfil) clienteConsultas.clear();
  }, [estado.perfil]);

  const ingresar = useCallback(async (documento: string, contrasena: string) => {
    const perfil = await api.post<Perfil>("/auth/ingresar", { documento, contrasena });
    setEstado({ perfil, avisoIngreso: null });
    return perfil;
  }, []);

  const salir = useCallback(async (motivo?: string) => {
    // Aunque falle la red, en este equipo la sesión se da por cerrada
    await api.post("/auth/salir").catch(() => undefined);
    setEstado({ perfil: null, avisoIngreso: motivo ? { mensaje: motivo, tipo: "info" } : null });
  }, []);

  const actualizarPerfil = useCallback((perfil: Perfil) => setEstado({ perfil, avisoIngreso: null }), []);

  const valor = useMemo(
    () => (config ? { config, ...estado, ingresar, salir, actualizarPerfil } : null),
    [config, estado, ingresar, salir, actualizarPerfil],
  );

  const reintentar = useCallback(() => {
    setCarga("cargando");
    setIntento((n) => n + 1);
  }, []);

  if (carga === "sin_conexion") return <PantallaSinConexion alReintentar={reintentar} />;
  if (!valor) return <PantallaCarga />;
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
