import type { ReactNode } from "react";
import { Marca } from "@/components/marca/SimboloSenda";
import { useSesion } from "@/sesion/useSesion";

// Marco de las pantallas sin menú (ingreso y compuertas de primer ingreso). En escritorio, el panel de
// marca en verde selva con las curvas de nivel; en el celular, solo la marca arriba y el formulario.
export function MarcoAcceso({ children, ancho = "max-w-sm" }: { children: ReactNode; ancho?: string }) {
  const { config } = useSesion();

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="fondo-curvas sticky top-0 hidden h-svh flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground [--opacidad-curvas:0.16] [--tinta-curvas:var(--primary-foreground)] lg:flex">
        <Marca nombre={config.productoNombre} className="text-2xl" />
        <p className="max-w-md font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance">
          Tu camino académico, paso a paso.
        </p>
        <p className="text-sm">{config.fundacionNombre}</p>
      </aside>

      <div className="fondo-curvas flex min-h-svh flex-col px-5 pt-6 pb-8 sm:px-8 lg:px-16">
        <Marca nombre={config.productoNombre} className="text-xl lg:hidden" />
        <main className={`mx-auto flex w-full ${ancho} flex-1 flex-col justify-center py-10`}>{children}</main>
        <p className="text-center text-sm text-muted-foreground lg:hidden">{config.fundacionNombre}</p>
      </div>
    </div>
  );
}
