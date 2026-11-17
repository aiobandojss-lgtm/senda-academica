import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { Cuota, Pago } from "@/lib/consultas";
import { fecha, MEDIO_PAGO, pesos } from "@/lib/formato";

// Piezas del estado de cuenta (tarea 5.5; spec `cartera`, "Estado de cuenta"), para el estudiante y el
// administrador. Siempre ícono y texto, nunca solo color (docs/identidad-visual.md).

export function EstadoCuota({ cuota }: { cuota: Cuota }) {
  if (cuota.estado === "pagada") {
    return (
      <Badge variant="exito">
        <CircleCheck aria-hidden="true" />
        Pagada
      </Badge>
    );
  }
  if (cuota.estado === "vencida") {
    return (
      <Badge variant={cuota.diasAtraso > 30 ? "peligro" : "alerta"}>
        <TriangleAlert aria-hidden="true" />
        Vencida hace {cuota.diasAtraso === 1 ? "1 día" : `${cuota.diasAtraso} días`}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock aria-hidden="true" />
      Pendiente
    </Badge>
  );
}

function LineaPago({ pago, acciones }: { pago: Pago; acciones?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
      <span className={pago.anulado ? "text-muted-foreground line-through" : undefined}>
        {pesos(pago.valor)} · {fecha(pago.fechaPago)} · {MEDIO_PAGO[pago.medio]}
      </span>
      {pago.anulado ? <span className="text-sm text-muted-foreground">Anulado: {pago.motivoAnulacion}</span> : acciones}
    </li>
  );
}

// Cuotas como tarjetas: se leen igual en el celular y en el escritorio
export function ListaCuotas({
  cuotas,
  accionesCuota,
  accionesPago,
}: {
  cuotas: Cuota[];
  accionesCuota?: (cuota: Cuota) => ReactNode;
  accionesPago?: (pago: Pago) => ReactNode;
}) {
  return (
    <ul className="space-y-3">
      {cuotas.map((c) => (
        <li key={c.id} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{c.concepto}</p>
              <p className="text-sm text-muted-foreground">Vence el {fecha(c.fechaVencimiento)}</p>
            </div>
            <div className="flex items-center gap-1">
              <EstadoCuota cuota={c} />
              {accionesCuota?.(c)}
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-medium tabular-nums">{pesos(c.valor)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pagado</dt>
              <dd className="font-medium tabular-nums">{pesos(c.pagado)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="font-semibold tabular-nums">{pesos(c.saldo)}</dd>
            </div>
          </dl>
          {c.pagos.length > 0 && (
            <ul className="mt-3 divide-y border-t pt-1">
              {c.pagos.map((p) => (
                <LineaPago key={p.id} pago={p} acciones={accionesPago?.(p)} />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
