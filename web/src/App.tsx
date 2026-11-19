import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { MENU_POR_ROL } from "@/layout/menus";
import LayoutRol from "@/layout/LayoutRol";
import type { Perfil, Rol } from "@/lib/api";
import { clienteConsultas } from "@/lib/consultas";
import AceptarAviso from "@/pantallas/acceso/AceptarAviso";
import CambiarContrasena from "@/pantallas/acceso/CambiarContrasena";
import Ingresar from "@/pantallas/acceso/Ingresar";
import { InicioRol, SeccionPendiente } from "@/pantallas/InicioRol";
import { ProveedorSesion } from "@/sesion/ContextoSesion";
import { destinoDe, INICIO_POR_ROL, RUTAS, sinCompuertas } from "@/sesion/destino";
import { useSesion } from "@/sesion/useSesion";

const ROLES: Rol[] = ["admin", "docente", "estudiante"];

// Las pantallas de administración se cargan aparte (división por rutas): el estudiante que entra desde
// el celular no descarga tablas, diálogos ni formularios que nunca va a usar. El Suspense que muestra la
// espera está en LayoutRol.
const Carreras = lazy(() => import("@/pantallas/admin/Carreras"));
const CarreraDetalle = lazy(() => import("@/pantallas/admin/CarreraDetalle"));
const Docentes = lazy(() => import("@/pantallas/admin/Docentes"));
const Estudiantes = lazy(() => import("@/pantallas/admin/Estudiantes"));

// Docente y estudiante (tarea 4.4)
const InicioDocente = lazy(() => import("@/pantallas/docente/CursosDocente").then((m) => ({ default: m.InicioDocente })));
const MisCursosDocente = lazy(() => import("@/pantallas/docente/CursosDocente").then((m) => ({ default: m.MisCursosDocente })));
const CursoDocente = lazy(() => import("@/pantallas/docente/CursoDocente"));
const ActividadDocente = lazy(() => import("@/pantallas/docente/ActividadDocente"));
const InicioEstudiante = lazy(() => import("@/pantallas/estudiante/InicioEstudiante"));
const MisCursosEstudiante = lazy(() => import("@/pantallas/estudiante/CursosEstudiante").then((m) => ({ default: m.MisCursosEstudiante })));
const CursoEstudiante = lazy(() => import("@/pantallas/estudiante/CursosEstudiante").then((m) => ({ default: m.CursoEstudiante })));
const ActividadEstudiante = lazy(() => import("@/pantallas/estudiante/ActividadEstudiante"));

// Cartera (tarea 5.5)
const Cartera = lazy(() => import("@/pantallas/admin/Cartera"));
const EstadoCuentaAdmin = lazy(() => import("@/pantallas/admin/EstadoCuentaAdmin"));
const EstadoCuentaEstudiante = lazy(() => import("@/pantallas/estudiante/EstadoCuentaEstudiante"));

// Asistente académico (RAG tarea 3.4)
const AsistenteEstudiante = lazy(() => import("@/pantallas/estudiante/AsistenteEstudiante"));

// Inicio de cada rol
const INICIOS: Record<Rol, ReactNode> = {
  admin: <InicioRol />,
  docente: <InicioDocente />,
  estudiante: <InicioEstudiante />,
};

// Pantallas de detalle, fuera del menú
const DETALLES: Record<Rol, { ruta: string; pantalla: ReactNode }[]> = {
  admin: [
    { ruta: "/admin/carreras/:id", pantalla: <CarreraDetalle /> },
    { ruta: "/admin/estudiantes/:id/cuenta", pantalla: <EstadoCuentaAdmin /> },
  ],
  docente: [
    { ruta: "/docente/cursos/:id", pantalla: <CursoDocente /> },
    { ruta: "/docente/actividades/:id", pantalla: <ActividadDocente /> },
  ],
  estudiante: [
    { ruta: "/estudiante/cursos/:id", pantalla: <CursoEstudiante /> },
    { ruta: "/estudiante/actividades/:id", pantalla: <ActividadEstudiante /> },
  ],
};

// Secciones del menú ya construidas; las demás muestran SeccionPendiente hasta su tarea
const PANTALLAS: Record<string, ReactNode> = {
  "/admin/carreras": <Carreras />,
  "/admin/estudiantes": <Estudiantes />,
  "/admin/docentes": <Docentes />,
  "/docente/cursos": <MisCursosDocente />,
  "/estudiante/cursos": <MisCursosEstudiante />,
  "/admin/cartera": <Cartera />,
  "/estudiante/cuenta": <EstadoCuentaEstudiante />,
  "/estudiante/asistente": <AsistenteEstudiante />,
};

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
    <QueryClientProvider client={clienteConsultas}>
      <BrowserRouter>
        <ProveedorSesion>
          <Rutas />
        </ProveedorSesion>
      </BrowserRouter>
      <Toaster position="top-center" richColors={false} />
    </QueryClientProvider>
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
            <Route index element={INICIOS[rol]} />
            {MENU_POR_ROL[rol]
              .filter((item) => item.ruta !== INICIO_POR_ROL[rol])
              .map((item) => (
                <Route key={item.ruta} path={item.ruta} element={PANTALLAS[item.ruta] ?? <SeccionPendiente titulo={item.titulo} />} />
              ))}
            {DETALLES[rol].map((d) => (
              <Route key={d.ruta} path={d.ruta} element={d.pantalla} />
            ))}
          </Route>
        ))}
      </Route>

      <Route path="*" element={<IrAlDestino />} />
    </Routes>
  );
}
