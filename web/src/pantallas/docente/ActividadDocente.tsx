import { CalendarClock, Download, PenLine } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { EstadoEntrega, Volver } from "@/components/academico/piezas";
import { ErrorGeneral, EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { type Entrega, type FilaSeguimiento, useActividadDocente, useCambio, useSeguimiento } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { fechaHora, nota, TIPO_ACTIVIDAD } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useTituloPagina } from "@/sesion/useSesion";

// Seguimiento y calificación de una actividad (tarea 4.4; spec "Seguimiento de entregas" y "Calificación").
// Solo nombres y apellidos de los estudiantes: nunca sus datos de contacto (D18).
export default function ActividadDocente() {
  const id = Number(useParams().id);
  const actividad = useActividadDocente(id);
  const seguimiento = useSeguimiento(id);
  useTituloPagina(actividad.data?.titulo ?? "Entregas");
  const [calificando, setCalificando] = useState<FilaSeguimiento | null>(null);

  const filas = seguimiento.data ?? [];
  const resumen = {
    entregaron: filas.filter((f) => f.entrega.estado !== "sin_entregar").length,
    calificadas: filas.filter((f) => f.entrega.estado === "calificada").length,
  };

  return (
    <div className={`max-w-4xl space-y-6 ${ENTRADA}`}>
      {actividad.data && <Volver a={`/docente/cursos/${actividad.data.cursoId}`} texto="Actividades del curso" />}
      <EstadoConsulta
        cargando={actividad.isPending || seguimiento.isPending}
        error={actividad.error ?? seguimiento.error}
        alReintentar={() => void Promise.all([actividad.refetch(), seguimiento.refetch()])}
      />

      {actividad.data && (
        <header className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-accent-foreground uppercase">{TIPO_ACTIVIDAD[actividad.data.tipo]}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{actividad.data.titulo}</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
            Fecha límite: {fechaHora(actividad.data.fechaLimite)}
          </p>
          {seguimiento.data && (
            <p>
              <span className="font-semibold tabular-nums">{resumen.entregaron}</span> de {filas.length} entregaron ·{" "}
              <span className="font-semibold tabular-nums">{resumen.calificadas}</span> calificadas
            </p>
          )}
        </header>
      )}

      {seguimiento.data?.length === 0 && <ListaVacia>Este curso no tiene estudiantes inscritos.</ListaVacia>}
      {filas.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead className="hidden sm:table-cell">Estado</TableHead>
                <TableHead className="hidden md:table-cell">Entregada</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.estudiante.id}>
                  <TableCell className="font-medium whitespace-normal">
                    {f.estudiante.apellidos}, {f.estudiante.nombres}
                    {/* En el celular el estado va debajo del nombre: con su propia columna, la tabla no cabía y el botón
                        de calificar quedaba cortado (revisión visual, tarea 6.2) */}
                    <div className="mt-1.5 sm:hidden">
                      <EstadoEntrega entrega={f.entrega} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-normal sm:table-cell">
                    <EstadoEntrega entrega={f.entrega} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {f.entrega.entregadoEn ? fechaHora(f.entrega.entregadoEn) : "—"}
                  </TableCell>
                  <TableCell>
                    {f.entrega.id && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <a href={`/api/archivos/entregas/${f.entrega.id}`} aria-label={`Descargar la entrega de ${f.estudiante.nombres} ${f.estudiante.apellidos}`}>
                            <Download aria-hidden="true" />
                          </a>
                        </Button>
                        <Button variant={f.entrega.estado === "calificada" ? "ghost" : "secondary"} onClick={() => setCalificando(f)}>
                          <PenLine data-icon="inline-start" aria-hidden="true" />
                          {f.entrega.estado === "calificada" ? "Corregir" : "Calificar"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={calificando !== null} onOpenChange={(abierto) => !abierto && setCalificando(null)}>
        <DialogContent className="sm:max-w-lg">
          {calificando?.entrega.id && (
            <FormularioNota
              estudiante={`${calificando.estudiante.nombres} ${calificando.estudiante.apellidos}`}
              entrega={calificando.entrega}
              alTerminar={() => setCalificando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormularioNota({ estudiante, entrega, alTerminar }: { estudiante: string; entrega: Entrega; alTerminar: () => void }) {
  // Se escribe con coma, como se usa en Colombia (4,2); también se acepta el punto
  const [valor, setValor] = useState(entrega.nota === null ? "" : nota(entrega.nota));
  const [comentario, setComentario] = useState(entrega.comentario ?? "");
  const [errores, setErrores] = useState(SIN_ERRORES);
  const calificar = useCambio((cuerpo: { nota: number; comentario: string }) => api.put<Entrega>(`/entregas/${entrega.id}/calificacion`, cuerpo));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const numero = Number(valor.trim().replace(",", "."));
    if (valor.trim() === "" || Number.isNaN(numero)) {
      setErrores({ campos: { nota: "Escribe la nota, por ejemplo 4,2" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    calificar.mutate(
      { nota: numero, comentario },
      {
        onSuccess: (e) => {
          toast.success(`Nota de ${estudiante}: ${nota(e.nota ?? 0)}`);
          alTerminar();
        },
        onError: (error) => setErrores(erroresDe(error)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{entrega.nota === null ? "Calificar" : "Corregir la nota"}</DialogTitle>
        <DialogDescription>
          {estudiante} · {entrega.nombreArchivo}
          {entrega.tardia && " · entregada tarde"}
        </DialogDescription>
      </DialogHeader>
      <Button variant="outline" asChild>
        <a href={`/api/archivos/entregas/${entrega.id}`}>
          <Download data-icon="inline-start" aria-hidden="true" />
          Descargar la entrega
        </a>
      </Button>
      <FieldGroup>
        <Campo id="nota" etiqueta="Nota" descripcion="De 0,0 a 5,0, con un decimal" error={errores.campos.nota}>
          {(control) => (
            <Input {...control} inputMode="decimal" className="w-32 text-lg tabular-nums" value={valor} onChange={(e) => setValor(e.target.value)} required />
          )}
        </Campo>
        <Campo id="comentario" etiqueta="Comentario (opcional)" error={errores.campos.comentario}>
          {(control) => <Textarea {...control} value={comentario} onChange={(e) => setComentario(e.target.value)} rows={4} />}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={alTerminar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={calificar.isPending}>
          {calificar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          Guardar nota
        </Button>
      </DialogFooter>
    </form>
  );
}
