import { ArrowLeft, CircleCheck, CircleDashed, Clock, FileCheck } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Entrega } from "@/lib/consultas";
import { nota } from "@/lib/formato";

// Piezas del docente y del estudiante (tarea 4.4)

// Estado de una entrega con ícono y texto, nunca solo color (docs/identidad-visual.md). "Tardía" se
// muestra también en las calificadas: el docente debe verlo aunque ya haya puesto la nota.
export function EstadoEntrega({ entrega }: { entrega: Entrega }) {
  if (entrega.estado === "calificada") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge variant="exito">
          <CircleCheck aria-hidden="true" />
          Calificada · {nota(entrega.nota ?? 0)}
        </Badge>
        {entrega.tardia && <EtiquetaTardia />}
      </span>
    );
  }
  if (entrega.estado === "tardia") return <EtiquetaTardia />;
  if (entrega.estado === "entregada") {
    return (
      <Badge variant="info">
        <FileCheck aria-hidden="true" />
        Entregada
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <CircleDashed aria-hidden="true" />
      Sin entregar
    </Badge>
  );
}

function EtiquetaTardia() {
  return (
    <Badge variant="alerta">
      <Clock aria-hidden="true" />
      Tardía
    </Badge>
  );
}

export function Volver({ a, texto }: { a: string; texto: string }) {
  return (
    <Button variant="link" asChild className="-ml-4 h-auto px-4 py-1">
      <Link to={a}>
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        {texto}
      </Link>
    </Button>
  );
}
