import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Encabezado, EstadoCarteraBadge, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResumenCartera } from "@/lib/consultas";
import { pesos } from "@/lib/formato";
import { useTituloPagina } from "@/sesion/useSesion";

const MES = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "long", year: "numeric" });

// Resumen de cartera (tarea 5.5; spec "Resumen de cartera"): recaudado del mes, total vencido y estudiantes
// con cuotas vencidas, primero los de más días de atraso
export default function Cartera() {
  useTituloPagina("Cartera");
  const consulta = useResumenCartera();
  const resumen = consulta.data;
  const bloqueados = resumen?.enMora.filter((e) => e.estadoCartera === "bloqueado").length ?? 0;

  return (
    <Pagina>
      <Encabezado titulo="Cartera" descripcion="Lo recaudado, lo vencido y quiénes deben. Para registrar un pago, entra al estado de cuenta del estudiante." />
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />

      {resumen && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Recaudado en {MES.format(new Date(`${resumen.mes}-01T00:00:00Z`))}</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">{pesos(resumen.recaudadoMes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Total vencido</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">{pesos(resumen.totalVencido)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Estudiantes con cuotas vencidas</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">{resumen.enMora.length}</p>
                <p className="text-sm text-muted-foreground">{bloqueados === 1 ? "1 con acceso suspendido" : `${bloqueados} con acceso suspendido`}</p>
              </CardContent>
            </Card>
          </div>

          {resumen.enMora.length === 0 ? (
            <ListaVacia>Ningún estudiante tiene cuotas vencidas.</ListaVacia>
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead className="text-right">Atraso</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Vencido</TableHead>
                    <TableHead>Cartera</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Ver</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumen.enMora.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">
                          {e.nombres} {e.apellidos}
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          {e.documento} · {e.carrera.codigo}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.diasAtraso} días</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{pesos(e.saldoVencido)}</TableCell>
                      <TableCell>
                        <EstadoCarteraBadge estado={e.estadoCartera} />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/estudiantes/${e.id}/cuenta`}
                          className="grid size-10 place-items-center rounded-lg hover:bg-muted"
                          aria-label={`Estado de cuenta de ${e.nombres} ${e.apellidos}`}
                        >
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </Pagina>
  );
}
