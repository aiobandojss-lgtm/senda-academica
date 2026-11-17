import { CalendarClock, CircleAlert, CircleCheck, Lock, RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EstadoCartera } from "@/lib/consultas";
import { ENTRADA } from "@/lib/movimiento";
import { TEXTO_ESTADO_CARTERA } from "@/lib/textos";

// Piezas que comparten las pantallas de administración (tarea 3.4)

// Estados de cartera de D6 con su variante, su ícono y su texto: nunca solo color (docs/identidad-visual.md)
const ESTADOS: Record<EstadoCartera, { variante: "exito" | "alerta" | "peligro" | "info"; Icono: typeof Lock }> = {
  al_dia: { variante: "exito", Icono: CircleCheck },
  en_riesgo: { variante: "alerta", Icono: TriangleAlert },
  bloqueado: { variante: "peligro", Icono: Lock },
  con_excepcion: { variante: "info", Icono: CalendarClock },
};

export function EstadoCarteraBadge({ estado }: { estado: EstadoCartera }) {
  const { variante, Icono } = ESTADOS[estado];
  return (
    <Badge variant={variante}>
      <Icono aria-hidden="true" />
      {TEXTO_ESTADO_CARTERA[estado]}
    </Badge>
  );
}

// Activo o inactivo: un usuario, una carrera o un curso desactivados no se borran, solo se marcan
export function EstadoActivo({ activo, femenino = false }: { activo: boolean; femenino?: boolean }) {
  if (activo) return null;
  return <Badge variant="outline">{femenino ? "Inactiva" : "Inactivo"}</Badge>;
}

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl min-w-0 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Pagina({ children }: { children: ReactNode }) {
  return <div className={`max-w-6xl space-y-6 ${ENTRADA}`}>{children}</div>;
}

// Mientras carga, filas de esqueleto; si falla, el mensaje de la API y un botón para reintentar
export function EstadoConsulta({ cargando, error, alReintentar }: { cargando: boolean; error: Error | null; alReintentar: () => void }) {
  if (cargando) {
    return (
      <div className="space-y-2" role="status" aria-label="Cargando">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive" className="bg-peligro-suave">
        <CircleAlert aria-hidden="true" />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {error.message}
          <Button variant="outline" size="sm" onClick={alReintentar}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function ListaVacia({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">{children}</p>;
}

// Error general de un formulario (lo que no corresponde a un campo)
export function ErrorGeneral({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <Alert variant="destructive" className="bg-peligro-suave">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  );
}
