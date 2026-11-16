import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { MENU_POR_ROL } from "@/layout/menus";
import LayoutRol from "@/layout/LayoutRol";
import type { Perfil, Rol } from "@/lib/api";
import AceptarAviso from "@/pantallas/acceso/AceptarAviso";
import CambiarContrasena from "@/pantallas/acceso/CambiarContrasena";
import Ingresar from "@/pantallas/acceso/Ingresar";
import { InicioRol, SeccionPendiente } from "@/pantallas/InicioRol";
import { ProveedorSesion } from "@/sesion/ContextoSesion";
import { destinoDe, INICIO_POR_ROL, RUTAS, sinCompuertas } from "@/sesion/destino";
import { useSesion } from "@/sesion/useSesion";

const ROLES: Rol[] = ["admin", "docente", "estudiante"];

// Puerta de una ruta: si el estado de la sesión no le corresponde, lleva a la persona a su destino
// (destino.ts). Es comodidad de navegación; la seguridad real está en la API, que niega por defecto (D4).
function Puerta({ permite, children }: { permite: (perfil: Perfil | null) => boolean; children: ReactNode }) {
  const { perfil } = useSesion();
  return permite(perfil) ? children : <Navigate to={destinoDe(perfil)} replace />;
}

function IrAlDestino() {
  const { perfil } = useSesion();
  return <Navigate to={destinoDe(perfil)} replace />;
}

// La plataforma: enrutador del navegador y sesión cargada antes de la primera pantalla
export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Rutas />
      </ProveedorSesion>
    </BrowserRouter>
  );
}

function Rutas() {
  return (
    <Routes>
      <Route path={RUTAS.ingresar} element={<Puerta permite={(p) => !p}><Ingresar /></Puerta>} />

      {/* Compuertas de primer ingreso (D16), en el mismo orden que las aplica la API */}
      <Route
        path={RUTAS.cambiarContrasenaObligatorio}
        element={<Puerta permite={(p) => !!p?.debeCambiarPassword}><CambiarContrasena obligatorio /></Puerta>}
      />
      <Route
        path={RUTAS.aceptarAviso}
        element={<Puerta permite={(p) => !!p && !p.debeCambiarPassword && p.debeAceptarAviso}><AceptarAviso /></Puerta>}
      />

      {/* Con sesión y sin compuertas: layout con el menú del rol */}
      <Route element={<Puerta permite={sinCompuertas}><LayoutRol /></Puerta>}>
        <Route path={RUTAS.cambiarContrasena} element={<CambiarContrasena />} />
        {ROLES.map((rol) => (
          <Route
            key={rol}
            path={INICIO_POR_ROL[rol]}
            element={<Puerta permite={(p) => p?.rol === rol}><Outlet /></Puerta>}
          >
            <Route index element={<InicioRol />} />
            {MENU_POR_ROL[rol]
              .filter((item) => item.ruta !== INICIO_POR_ROL[rol])
              .map((item) => (
                <Route key={item.ruta} path={item.ruta} element={<SeccionPendiente titulo={item.titulo} />} />
              ))}
          </Route>
        ))}
      </Route>

      <Route path="*" element={<IrAlDestino />} />
    </Routes>
  );
}
