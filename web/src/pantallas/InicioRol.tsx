import { ChevronRight, Hammer } from "lucide-react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ETIQUETA_ROL, MENU_POR_ROL } from "@/layout/menus";
import { ENTRADA } from "@/lib/movimiento";
import { INICIO_POR_ROL } from "@/sesion/destino";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Inicio provisional de cada rol (tarea 2.6): saluda y lleva a las secciones del menú, que en el celular
// queda detrás de un botón. Las tareas 3.4, 4.4 y 5.5 lo llenan con los datos reales de la API.
export function InicioRol() {
  useTituloPagina("Inicio");
  const { perfil, config } = useSesion();
  if (!perfil) return null;
  const secciones = MENU_POR_ROL[perfil.rol].filter((item) => item.ruta !== INICIO_POR_ROL[perfil.rol]);

  return (
    <div className={`max-w-3xl space-y-8 ${ENTRADA}`}>
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {ETIQUETA_ROL[perfil.rol]} · {config.fundacionNombre}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Hola, {perfil.nombres}</h1>
      </header>

      <nav aria-label="Secciones" className="grid gap-3 sm:grid-cols-2">
        {secciones.map((item) => (
          <Link
            key={item.ruta}
            to={item.ruta}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:bg-muted/60">
              <CardContent className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <item.icono className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.titulo}</span>
                  <span className="block text-sm text-muted-foreground">{item.descripcion}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </nav>
    </div>
  );
}

// Pantalla provisional de una sección que todavía no está construida
export function SeccionPendiente({ titulo }: { titulo: string }) {
  useTituloPagina(titulo);
  return (
    <div className={`max-w-3xl space-y-6 ${ENTRADA}`}>
      <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
      <Card>
        <CardContent className="flex items-center gap-3 text-muted-foreground">
          <Hammer className="size-5 shrink-0" aria-hidden="true" />
          Esta sección estará lista pronto.
        </CardContent>
      </Card>
    </div>
  );
}
