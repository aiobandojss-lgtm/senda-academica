import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { EstadoCarteraBadge, EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { ListaCuotas } from "@/components/cartera/piezas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mensajeCartera } from "@/lib/cartera";
import { useEstadoCuentaPropio } from "@/lib/consultas";
import { pesos } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Estado de cuenta del estudiante (tarea 5.5; spec "Estado de cuenta"): cada cuota con vencimiento, valor,
// pagado, saldo y estado, y el total que debe. Si estuviera bloqueado no llegaría aquí (spec `bloqueo-mora`).
export default function EstadoCuentaEstudiante() {
  useTituloPagina("Estado de cuenta");
  const { config } = useSesion();
  const consulta = useEstadoCuentaPropio();
  const cuenta = consulta.data;

  return (
    <div className={`max-w-2xl space-y-6 ${ENTRADA}`}>
      <h1 className="text-3xl font-semibold tracking-tight">Estado de cuenta</h1>
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />

      {cuenta && (
        <>
          <Card>
            <CardContent className="space-y-4">
              <EstadoCarteraBadge estado={cuenta.estadoCartera} />
              <p>{mensajeCartera(cuenta, config.contactoFundacion, "tu")}</p>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Total que debes</dt>
                  <dd className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{pesos(cuenta.totalAdeudado)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Vencido</dt>
                  <dd className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{pesos(cuenta.totalVencido)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {cuenta.cuotas.length === 0 ? <ListaVacia>No tienes cuotas registradas.</ListaVacia> : <ListaCuotas cuotas={cuenta.cuotas} />}
        </>
      )}
    </div>
  );
}

// Tarjeta del inicio del estudiante (composición de docs/identidad-visual.md)
export function TarjetaEstadoCuenta() {
  const { config } = useSesion();
  const consulta = useEstadoCuentaPropio();
  if (!consulta.data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tu estado de cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <EstadoCarteraBadge estado={consulta.data.estadoCartera} />
        <p className="text-sm">{mensajeCartera(consulta.data, config.contactoFundacion, "tu")}</p>
        {/* Botón de 40 px y no un enlace de texto de 20 px: la guía pide objetivos táctiles de 40 a 44 px (tarea 6.2) */}
        <Button variant="outline" asChild>
          <Link to="/estudiante/cuenta">
            Ver mis cuotas y pagos
            <ChevronRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
