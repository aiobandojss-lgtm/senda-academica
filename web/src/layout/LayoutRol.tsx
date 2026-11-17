import { KeyRound, LogOut, Menu } from "lucide-react";
import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { Marca } from "@/components/marca/SimboloSenda";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Perfil } from "@/lib/api";
import { INICIO_POR_ROL, RUTAS } from "@/sesion/destino";
import { useSesion } from "@/sesion/useSesion";
import { ETIQUETA_ROL, MENU_POR_ROL } from "./menus";

// Layout de las pantallas con sesión (tarea 2.6): menú lateral en escritorio; en el celular el menú se
// abre desde el botón de la barra superior (Sidebar de shadcn/ui, que en pantallas angostas usa un Sheet).
export default function LayoutRol() {
  const { perfil, config } = useSesion();
  // La puerta de App.tsx garantiza que hay perfil y que pasó las compuertas
  if (!perfil) return null;

  return (
    <SidebarProvider>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <MenuLateral perfil={perfil} productoNombre={config.productoNombre} />
      <SidebarInset>
        <BarraSuperior productoNombre={config.productoNombre} />
        {/* SidebarInset ya es el <main> de la página: aquí va un div para no anidar dos landmarks */}
        <div id="contenido" tabIndex={-1} className="flex-1 px-5 py-8 outline-none md:px-10 md:py-10">
          <Suspense
            fallback={
              <div className="grid min-h-40 place-items-center">
                <Spinner className="size-5 text-primary" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function BarraSuperior({ productoNombre }: { productoNombre: string }) {
  const { toggleSidebar } = useSidebar();
  // Solo en el celular: en escritorio el menú siempre está a la vista
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:hidden">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Abrir el menú">
        <Menu aria-hidden="true" />
      </Button>
      <Marca nombre={productoNombre} className="text-lg" />
    </header>
  );
}

function MenuLateral({ perfil, productoNombre }: { perfil: Perfil; productoNombre: string }) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const cerrarEnCelular = () => setOpenMobile(false);
  const inicio = INICIO_POR_ROL[perfil.rol];
  const { salir } = useSesion();

  // Activo si es la ruta exacta o una subruta (p. ej. /docente/cursos/12); el inicio solo con la exacta
  const estaActiva = (ruta: string) => pathname === ruta || (ruta !== inicio && pathname.startsWith(`${ruta}/`));

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Marca nombre={productoNombre} className="text-xl" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{ETIQUETA_ROL[perfil.rol]}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU_POR_ROL[perfil.rol].map((item) => (
                <SidebarMenuItem key={item.ruta}>
                  <SidebarMenuButton asChild isActive={estaActiva(item.ruta)} className="h-10 text-[0.95rem]">
                    <NavLink to={item.ruta} end={item.ruta === inicio} onClick={cerrarEnCelular}>
                      <item.icono aria-hidden="true" />
                      <span>{item.titulo}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1 pb-4">
        <SidebarSeparator className="mx-0 mb-2" />
        <div className="px-2 pb-1">
          <p className="truncate font-medium">
            {perfil.nombres} {perfil.apellidos}
          </p>
          <p className="text-sm text-muted-foreground">{ETIQUETA_ROL[perfil.rol]}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === RUTAS.cambiarContrasena} className="h-10">
              <NavLink to={RUTAS.cambiarContrasena} onClick={cerrarEnCelular}>
                <KeyRound aria-hidden="true" />
                <span>Cambiar contraseña</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10" onClick={() => void salir()}>
              <LogOut aria-hidden="true" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
