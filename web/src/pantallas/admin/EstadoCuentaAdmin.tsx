import { CalendarClock, CalendarPlus, EllipsisVertical, HandCoins, ListPlus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { Volver } from "@/components/academico/piezas";
import { Confirmar } from "@/components/admin/dialogos";
import { Encabezado, ErrorGeneral, EstadoCarteraBadge, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { ListaCuotas } from "@/components/cartera/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { mensajeCartera } from "@/lib/cartera";
import { type Cuota, type Pago, useCambio, useEstadoCuenta } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { fecha, hoyColombia, MEDIO_PAGO, pesos } from "@/lib/formato";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Estado de cuenta de un estudiante para el administrador (tarea 5.5; spec `cartera` y `bloqueo-mora`): plan
// de cuotas, cuotas sueltas, pagos, anulaciones y excepciones. El pago que salda la cuota en mora desbloquea
// al estudiante de inmediato (D6): aquí ocurre ese momento de la demo.

// "250.000", "250000" o "$ 250.000" → 250000; null si no es un entero positivo
const aPesos = (texto: string) => {
  const limpio = texto.replace(/[$\s.]/g, "");
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
};

type Dialogo =
  | { tipo: "plan" }
  | { tipo: "cuota"; cuota: Cuota | null }
  | { tipo: "pago"; cuota: Cuota }
  | { tipo: "excepcion" }
  | null;

export default function EstadoCuentaAdmin() {
  const id = Number(useParams().id);
  const { config } = useSesion();
  const consulta = useEstadoCuenta(id);
  const cuenta = consulta.data;
  useTituloPagina(cuenta ? `Cuenta de ${cuenta.estudiante.nombres}` : "Estado de cuenta");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [eliminando, setEliminando] = useState<Cuota | null>(null);
  const [anulando, setAnulando] = useState<Pago | null>(null);
  const cerrar = () => setDialogo(null);

  const eliminar = useCambio((cuota: Cuota) => api.delete(`/cuotas/${cuota.id}`));

  return (
    <Pagina>
      <Volver a="/admin/estudiantes" texto="Estudiantes" />
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />

      {cuenta && (
        <>
          <Encabezado
            titulo={`${cuenta.estudiante.nombres} ${cuenta.estudiante.apellidos}`}
            descripcion="Estado de cuenta"
            acciones={
              <>
                <Button variant="outline" onClick={() => setDialogo({ tipo: "plan" })}>
                  <ListPlus data-icon="inline-start" aria-hidden="true" />
                  Generar plan
                </Button>
                <Button variant="outline" onClick={() => setDialogo({ tipo: "cuota", cuota: null })}>
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Agregar cuota
                </Button>
                <Button variant="outline" onClick={() => setDialogo({ tipo: "excepcion" })}>
                  <CalendarPlus data-icon="inline-start" aria-hidden="true" />
                  Crear excepción
                </Button>
              </>
            }
          />

          <Card>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <EstadoCarteraBadge estado={cuenta.estadoCartera} />
                <p>{mensajeCartera(cuenta, config.contactoFundacion, "estudiante")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total adeudado</p>
                <p className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{pesos(cuenta.totalAdeudado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencido</p>
                <p className="font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{pesos(cuenta.totalVencido)}</p>
              </div>
            </CardContent>
          </Card>

          {cuenta.excepciones.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-sans text-sm font-medium tracking-wide text-muted-foreground uppercase">Excepciones</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {cuenta.excepciones.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="block font-medium">{e.motivo}</span>
                      <span className="block text-sm text-muted-foreground">Hasta el {fecha(e.hasta)}, inclusive</span>
                    </span>
                    <Badge variant={e.vigente ? "info" : "outline"}>
                      <CalendarClock aria-hidden="true" />
                      {e.vigente ? "Vigente" : "Vencida"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-sans text-sm font-medium tracking-wide text-muted-foreground uppercase">Cuotas</h2>
            {cuenta.cuotas.length === 0 ? (
              <ListaVacia>Este estudiante no tiene cuotas. Genera su plan de cuotas.</ListaVacia>
            ) : (
              <ListaCuotas
                cuotas={cuenta.cuotas}
                accionesCuota={(c) => (
                  <>
                    {c.saldo > 0 && (
                      <Button size="sm" onClick={() => setDialogo({ tipo: "pago", cuota: c })}>
                        <HandCoins data-icon="inline-start" aria-hidden="true" />
                        Registrar pago
                      </Button>
                    )}
                    {/* Una cuota con pagos, aunque estén anulados, no se edita ni se elimina (CUOTA_CON_PAGOS) */}
                    {c.pagos.length === 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Acciones de ${c.concepto}`}>
                            <EllipsisVertical aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialogo({ tipo: "cuota", cuota: c })}>
                            <Pencil aria-hidden="true" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setEliminando(c)}>
                            <Trash2 aria-hidden="true" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
                accionesPago={(p) => (
                  <Button variant="ghost" size="sm" onClick={() => setAnulando(p)}>
                    <Undo2 data-icon="inline-start" aria-hidden="true" />
                    Anular
                  </Button>
                )}
              />
            )}
          </section>
        </>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {dialogo?.tipo === "plan" && <FormularioPlan estudianteId={id} alTerminar={cerrar} />}
          {dialogo?.tipo === "cuota" && <FormularioCuota estudianteId={id} cuota={dialogo.cuota} alTerminar={cerrar} />}
          {dialogo?.tipo === "pago" && <FormularioPago cuota={dialogo.cuota} alTerminar={cerrar} />}
          {dialogo?.tipo === "excepcion" && <FormularioExcepcion estudianteId={id} alTerminar={cerrar} />}
        </DialogContent>
      </Dialog>
      <Confirmar
        abierto={eliminando !== null}
        alCambiar={(abierto) => !abierto && setEliminando(null)}
        titulo={`¿Eliminar ${eliminando?.concepto}?`}
        descripcion="Úsalo solo para una cuota creada por error: desaparece del plan y deja de contar para el saldo."
        accion="Eliminar cuota"
        peligro
        pendiente={eliminar.isPending}
        alConfirmar={() =>
          eliminando &&
          eliminar.mutate(eliminando, {
            onSuccess: () => {
              toast.success(`Se eliminó ${eliminando.concepto}`);
              setEliminando(null);
            },
            onError: (e) => toast.error(e.message),
          })
        }
      />
      <Dialog open={anulando !== null} onOpenChange={(abierto) => !abierto && setAnulando(null)}>
        <DialogContent className="sm:max-w-md">{anulando && <FormularioAnular pago={anulando} alTerminar={() => setAnulando(null)} />}</DialogContent>
      </Dialog>
    </Pagina>
  );
}

function Pie({ pendiente, accion, alCancelar }: { pendiente: boolean; accion: string; alCancelar: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={alCancelar}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pendiente}>
        {pendiente && <Spinner data-icon="inline-start" aria-hidden="true" />}
        {accion}
      </Button>
    </DialogFooter>
  );
}

function FormularioPago({ cuota, alTerminar }: { cuota: Cuota; alTerminar: () => void }) {
  // Con puntos de miles, como se escribe en Colombia: "180.000"
  const [valor, setValor] = useState(pesos(cuota.saldo).replace(/^\$\s/, ""));
  const [fechaPago, setFechaPago] = useState(hoyColombia());
  const [medio, setMedio] = useState<Pago["medio"]>("transferencia");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const registrar = useCambio((cuerpo: { valor: number; fechaPago: string; medio: string }) => api.post<Pago>(`/cuotas/${cuota.id}/pagos`, cuerpo));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const numero = aPesos(valor);
    if (!numero) {
      setErrores({ campos: { valor: "Escribe el valor en pesos, por ejemplo 250.000" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    registrar.mutate(
      { valor: numero, fechaPago, medio },
      {
        onSuccess: (p) => {
          toast.success(p.valor === cuota.saldo ? `Se registró el pago: ${cuota.concepto} quedó pagada` : `Se registró el pago de ${pesos(p.valor)}`);
          alTerminar();
        },
        onError: (e) => setErrores(erroresDe(e)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Registrar pago</DialogTitle>
        <DialogDescription>
          {cuota.concepto} · saldo {pesos(cuota.saldo)}. Puede ser total o parcial.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Campo id="valor" etiqueta="Valor" descripcion={`Hasta ${pesos(cuota.saldo)}`} error={errores.campos.valor}>
          {(control) => <Input {...control} inputMode="numeric" className="tabular-nums" value={valor} onChange={(e) => setValor(e.target.value)} required />}
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="fechaPago" etiqueta="Fecha del pago" error={errores.campos.fechaPago}>
            {(control) => <Input {...control} type="date" max={hoyColombia()} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required />}
          </Campo>
          <Campo id="medio" etiqueta="Medio de pago" error={errores.campos.medio}>
            {(control) => (
              <Select value={medio} onValueChange={(v) => setMedio(v as Pago["medio"])}>
                <SelectTrigger {...control} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEDIO_PAGO) as Pago["medio"][]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEDIO_PAGO[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>
        </div>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <Pie pendiente={registrar.isPending} accion="Registrar pago" alCancelar={alTerminar} />
    </form>
  );
}

function FormularioAnular({ pago, alTerminar }: { pago: Pago; alTerminar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const anular = useCambio(() => api.post<Pago>(`/pagos/${pago.id}/anular`, { motivo }));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    anular.mutate(undefined, {
      onSuccess: () => {
        toast.success("Se anuló el pago: su valor vuelve al saldo de la cuota");
        alTerminar();
      },
      onError: (e) => setErrores(erroresDe(e)),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Anular pago</DialogTitle>
        <DialogDescription>
          {pesos(pago.valor)} del {fecha(pago.fechaPago)}. Queda en el historial y deja de contar para el saldo. No se puede deshacer: si fue un error de
          valor, anula y registra el pago correcto.
        </DialogDescription>
      </DialogHeader>
      <Campo id="motivo" etiqueta="Motivo" error={errores.campos.motivo}>
        {(control) => <Input {...control} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: valor errado" required />}
      </Campo>
      <ErrorGeneral mensaje={errores.general} />
      <Pie pendiente={anular.isPending} accion="Anular pago" alCancelar={alTerminar} />
    </form>
  );
}

function FormularioPlan({ estudianteId, alTerminar }: { estudianteId: number; alTerminar: () => void }) {
  const [concepto, setConcepto] = useState("Mensualidad");
  const [valor, setValor] = useState("");
  const [numero, setNumero] = useState("6");
  const [primerVencimiento, setPrimerVencimiento] = useState("");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const generar = useCambio((cuerpo: Record<string, unknown>) => api.post(`/estudiantes/${estudianteId}/cuotas/plan`, cuerpo));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const pesosValor = aPesos(valor);
    if (!pesosValor) {
      setErrores({ campos: { valor: "Escribe el valor de cada cuota en pesos, por ejemplo 180.000" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    generar.mutate(
      { concepto, valor: pesosValor, numero: Number(numero), primerVencimiento },
      {
        onSuccess: () => {
          toast.success(`Se generaron ${numero} cuotas`);
          alTerminar();
        },
        onError: (e) => setErrores(erroresDe(e)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Generar plan de cuotas</DialogTitle>
        <DialogDescription>Cuotas mensuales el mismo día. Si un mes no tiene ese día (29 a 31), vence el último día del mes.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Campo id="concepto" etiqueta="Concepto" descripcion='Se numera solo: "Mensualidad 1/6", "Mensualidad 2/6"…' error={errores.campos.concepto}>
          {(control) => <Input {...control} value={concepto} onChange={(e) => setConcepto(e.target.value)} required />}
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="valor" etiqueta="Valor de cada cuota" error={errores.campos.valor}>
            {(control) => <Input {...control} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="180.000" required />}
          </Campo>
          <Campo id="numero" etiqueta="Número de cuotas" error={errores.campos.numero}>
            {(control) => <Input {...control} type="number" min={1} max={24} value={numero} onChange={(e) => setNumero(e.target.value)} required />}
          </Campo>
        </div>
        <Campo id="primerVencimiento" etiqueta="Primer vencimiento" error={errores.campos.primerVencimiento}>
          {(control) => <Input {...control} type="date" value={primerVencimiento} onChange={(e) => setPrimerVencimiento(e.target.value)} required />}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <Pie pendiente={generar.isPending} accion="Generar cuotas" alCancelar={alTerminar} />
    </form>
  );
}

function FormularioCuota({ estudianteId, cuota, alTerminar }: { estudianteId: number; cuota: Cuota | null; alTerminar: () => void }) {
  const [concepto, setConcepto] = useState(cuota?.concepto ?? "Matrícula");
  const [valor, setValor] = useState(cuota ? String(cuota.valor) : "");
  const [fechaVencimiento, setFechaVencimiento] = useState(cuota?.fechaVencimiento ?? "");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const guardar = useCambio((cuerpo: Record<string, unknown>) =>
    cuota ? api.patch(`/cuotas/${cuota.id}`, cuerpo) : api.post(`/estudiantes/${estudianteId}/cuotas`, cuerpo),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const pesosValor = aPesos(valor);
    if (!pesosValor) {
      setErrores({ campos: { valor: "Escribe el valor en pesos, por ejemplo 350.000" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    guardar.mutate(
      { concepto, valor: pesosValor, fechaVencimiento },
      {
        onSuccess: () => {
          toast.success(cuota ? "Se guardó la cuota" : "Se agregó la cuota");
          alTerminar();
        },
        onError: (e) => setErrores(erroresDe(e)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{cuota ? "Editar cuota" : "Agregar cuota"}</DialogTitle>
        <DialogDescription>Una cuota con pagos registrados ya no se puede editar ni eliminar.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Campo id="concepto" etiqueta="Concepto" error={errores.campos.concepto}>
          {(control) => <Input {...control} value={concepto} onChange={(e) => setConcepto(e.target.value)} required />}
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="valor" etiqueta="Valor" error={errores.campos.valor}>
            {(control) => <Input {...control} inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="350.000" required />}
          </Campo>
          <Campo id="fechaVencimiento" etiqueta="Vencimiento" error={errores.campos.fechaVencimiento}>
            {(control) => <Input {...control} type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} required />}
          </Campo>
        </div>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <Pie pendiente={guardar.isPending} accion={cuota ? "Guardar cambios" : "Agregar cuota"} alCancelar={alTerminar} />
    </form>
  );
}

function FormularioExcepcion({ estudianteId, alTerminar }: { estudianteId: number; alTerminar: () => void }) {
  const [motivo, setMotivo] = useState("Acuerdo de pago");
  const [hasta, setHasta] = useState("");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const crear = useCambio((cuerpo: { motivo: string; hasta: string }) => api.post(`/estudiantes/${estudianteId}/excepciones`, cuerpo));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    crear.mutate(
      { motivo, hasta },
      {
        onSuccess: () => {
          toast.success(`Excepción vigente hasta el ${fecha(hasta)}`);
          alTerminar();
        },
        onError: (e) => setErrores(erroresDe(e)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Crear excepción</DialogTitle>
        <DialogDescription>Mientras esté vigente, el estudiante ingresa aunque tenga cuotas con más de 30 días de atraso.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Campo id="motivo" etiqueta="Motivo" error={errores.campos.motivo}>
          {(control) => <Input {...control} value={motivo} onChange={(e) => setMotivo(e.target.value)} required />}
        </Campo>
        <Campo id="hasta" etiqueta="Vigente hasta (inclusive)" error={errores.campos.hasta}>
          {(control) => <Input {...control} type="date" min={hoyColombia()} value={hasta} onChange={(e) => setHasta(e.target.value)} required />}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <Pie pendiente={crear.isPending} accion="Crear excepción" alCancelar={alTerminar} />
    </form>
  );
}
