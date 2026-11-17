import { CalendarClock, EllipsisVertical, Eye, EyeOff, FileText, Paperclip, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Volver } from "@/components/academico/piezas";
import { Confirmar } from "@/components/admin/dialogos";
import { ErrorGeneral, EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { type ActividadDocente, useActividadesDocente, useCambio, useCursosDocente } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { aHoraColombia, fechaHora, TIPO_ACTIVIDAD } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useTituloPagina } from "@/sesion/useSesion";

// Actividades de un curso del docente (tarea 4.4; spec "Publicación de actividades" y "Edición de actividades")
export default function CursoDocente() {
  const id = Number(useParams().id);
  const cursos = useCursosDocente();
  const actividades = useActividadesDocente(id);
  const curso = cursos.data?.find((c) => c.id === id);
  useTituloPagina(curso?.nombre ?? "Curso");
  const [formulario, setFormulario] = useState<"nueva" | ActividadDocente | null>(null);
  const [apoyo, setApoyo] = useState<ActividadDocente | null>(null);
  const [cambiandoPublicacion, setCambiandoPublicacion] = useState<ActividadDocente | null>(null);

  const publicar = useCambio((a: ActividadDocente) => api.patch<ActividadDocente>(`/actividades/${a.id}`, { publicada: !a.publicada }));
  const confirmarPublicacion = () => {
    if (!cambiandoPublicacion) return;
    publicar.mutate(cambiandoPublicacion, {
      onSuccess: (a) => {
        setCambiandoPublicacion(null);
        toast.success(a.publicada ? `${a.titulo} ya está visible para tus estudiantes` : `${a.titulo} volvió a borrador`);
      },
      onError: (error) => {
        setCambiandoPublicacion(null);
        toast.error(error.message);
      },
    });
  };

  return (
    <div className={`max-w-4xl space-y-6 ${ENTRADA}`}>
      <Volver a="/docente/cursos" texto="Mis cursos" />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{curso?.nombre ?? "Curso"}</h1>
          {curso && (
            <p className="text-muted-foreground">
              {curso.carrera.codigo} · semestre {curso.semestre} · {curso.inscritos} estudiantes
            </p>
          )}
        </div>
        <Button size="lg" onClick={() => setFormulario("nueva")}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Nueva actividad
        </Button>
      </header>

      <EstadoConsulta cargando={actividades.isPending} error={actividades.error} alReintentar={() => void actividades.refetch()} />
      {actividades.data?.length === 0 && <ListaVacia>Este curso todavía no tiene actividades. Crea la primera.</ListaVacia>}
      <div className="space-y-3">
        {actividades.data?.map((a) => (
          <Card key={a.id}>
            {/* CardHeader es una grilla: CardAction pone el menú a la derecha del título */}
            <CardHeader>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {a.publicada ? (
                    <Badge variant="exito">
                      <Eye aria-hidden="true" />
                      Publicada
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <EyeOff aria-hidden="true" />
                      Borrador
                    </Badge>
                  )}
                  {a.apoyo && (
                    <Badge variant="secondary">
                      <Paperclip aria-hidden="true" />
                      Apoyo {a.apoyo.formato.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg leading-snug">{a.titulo}</CardTitle>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                  {TIPO_ACTIVIDAD[a.tipo]} · {fechaHora(a.fechaLimite)}
                </p>
              </div>
              <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Acciones de ${a.titulo}`}>
                    <EllipsisVertical aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setFormulario(a)}>
                    <Pencil aria-hidden="true" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setApoyo(a)}>
                    <Paperclip aria-hidden="true" />
                    Archivo de apoyo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setCambiandoPublicacion(a)}>
                    {a.publicada ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {a.publicada ? "Volver a borrador" : "Publicar"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </CardAction>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <span className="font-semibold tabular-nums">{a.entregas}</span> de {a.inscritos} entregaron ·{" "}
                <span className="font-semibold tabular-nums">{a.calificadas}</span> calificadas
              </p>
            </CardContent>
            <CardFooter className="mt-auto">
              <Button asChild variant={a.entregas > a.calificadas ? "default" : "outline"}>
                <Link to={`/docente/actividades/${a.id}`}>
                  <Users data-icon="inline-start" aria-hidden="true" />
                  {a.entregas > a.calificadas ? `Calificar (${a.entregas - a.calificadas})` : "Ver entregas"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={formulario !== null} onOpenChange={(abierto) => !abierto && setFormulario(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          {formulario !== null && (
            <FormularioActividad cursoId={id} actividad={formulario === "nueva" ? null : formulario} alTerminar={() => setFormulario(null)} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={apoyo !== null} onOpenChange={(abierto) => !abierto && setApoyo(null)}>
        <DialogContent className="sm:max-w-lg">{apoyo && <FormularioApoyo actividad={apoyo} alTerminar={() => setApoyo(null)} />}</DialogContent>
      </Dialog>
      <Confirmar
        abierto={cambiandoPublicacion !== null}
        alCambiar={(abierto) => !abierto && setCambiandoPublicacion(null)}
        titulo={cambiandoPublicacion?.publicada ? "¿Volver a borrador?" : "¿Publicar la actividad?"}
        descripcion={
          cambiandoPublicacion?.publicada
            ? "Tus estudiantes dejarán de verla. Solo es posible mientras nadie haya entregado."
            : "Tus estudiantes la verán con su fecha límite y podrán entregar."
        }
        accion={cambiandoPublicacion?.publicada ? "Volver a borrador" : "Publicar"}
        pendiente={publicar.isPending}
        alConfirmar={confirmarPublicacion}
      />
    </div>
  );
}

type DatosActividad = { tipo: "taller" | "evaluacion"; titulo: string; instrucciones: string; fechaLimite: string };

function FormularioActividad({ cursoId, actividad, alTerminar }: { cursoId: number; actividad: ActividadDocente | null; alTerminar: () => void }) {
  const [datos, setDatos] = useState<DatosActividad>({
    tipo: actividad?.tipo ?? "taller",
    titulo: actividad?.titulo ?? "",
    instrucciones: actividad?.instrucciones ?? "",
    // El campo trabaja en hora de Colombia; la API la convierte a UTC (D20)
    fechaLimite: actividad ? aHoraColombia(actividad.fechaLimite) : "",
  });
  const [errores, setErrores] = useState(SIN_ERRORES);
  const cambiar = (cambio: Partial<DatosActividad>) => setDatos((d) => ({ ...d, ...cambio }));

  const guardar = useCambio((cuerpo: DatosActividad & { publicada?: boolean }) =>
    actividad ? api.patch<ActividadDocente>(`/actividades/${actividad.id}`, cuerpo) : api.post<ActividadDocente>(`/cursos/${cursoId}/actividades`, cuerpo),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    // Qué botón envió el formulario ("Guardar borrador" o "Publicar"). No se usa un estado: un setState en el
    // onClick todavía no se ha aplicado cuando llega este onSubmit, en el mismo clic.
    const publicar = ((evento.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "publicar";
    guardar.mutate(actividad ? datos : { ...datos, publicada: publicar }, {
      onSuccess: (a) => {
        toast.success(actividad ? `Se guardó ${a.titulo}` : a.publicada ? `${a.titulo} quedó publicada` : `${a.titulo} quedó en borrador`);
        alTerminar();
      },
      onError: (error) => setErrores(erroresDe(error)),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{actividad ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
        <DialogDescription>La fecha límite es en hora de Colombia. Si la amplías, las entregas que ya no estén vencidas dejan de verse tardías.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Campo id="tipo" etiqueta="Tipo" error={errores.campos.tipo}>
            {(control) => (
              <Select value={datos.tipo} onValueChange={(valor) => cambiar({ tipo: valor as DatosActividad["tipo"] })}>
                <SelectTrigger {...control} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taller">Taller</SelectItem>
                  <SelectItem value="evaluacion">Evaluación</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Campo>
          <Campo id="titulo" etiqueta="Título" error={errores.campos.titulo}>
            {(control) => <Input {...control} value={datos.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} required />}
          </Campo>
        </div>
        <Campo id="instrucciones" etiqueta="Instrucciones" error={errores.campos.instrucciones}>
          {(control) => <Textarea {...control} value={datos.instrucciones} onChange={(e) => cambiar({ instrucciones: e.target.value })} rows={5} required />}
        </Campo>
        <Campo id="fechaLimite" etiqueta="Fecha límite (hora de Colombia)" error={errores.campos.fechaLimite}>
          {(control) => (
            <Input {...control} type="datetime-local" value={datos.fechaLimite} onChange={(e) => cambiar({ fechaLimite: e.target.value })} required />
          )}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={alTerminar}>
          Cancelar
        </Button>
        {actividad ? (
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
            Guardar cambios
          </Button>
        ) : (
          <>
            <Button type="submit" variant="secondary" name="accion" value="borrador" disabled={guardar.isPending}>
              Guardar borrador
            </Button>
            <Button type="submit" name="accion" value="publicar" disabled={guardar.isPending}>
              {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
              Publicar
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}

function FormularioApoyo({ actividad, alTerminar }: { actividad: ActividadDocente; alTerminar: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subir = useCambio((elegido: File) => api.subirArchivo<ActividadDocente>("PUT", `/actividades/${actividad.id}/apoyo`, elegido));
  const quitar = useCambio(() => api.delete<ActividadDocente>(`/actividades/${actividad.id}/apoyo`));

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!archivo) return;
    setError(null);
    subir.mutate(archivo, {
      onSuccess: () => {
        toast.success("Se adjuntó el archivo de apoyo");
        alTerminar();
      },
      onError: (e) => setError(e.message),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <DialogHeader>
        <DialogTitle>Archivo de apoyo</DialogTitle>
        <DialogDescription>Por ejemplo, el enunciado o una guía. Lo descargan los estudiantes del curso cuando la actividad está publicada.</DialogDescription>
      </DialogHeader>
      {actividad.apoyo && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <FileText className="size-4 text-primary" aria-hidden="true" />
          <span className="flex-1 text-sm">Archivo actual ({actividad.apoyo.formato.toUpperCase()})</span>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/api/archivos/apoyos/${actividad.id}`}>Descargar</a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={quitar.isPending}
            onClick={() =>
              quitar.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Se quitó el archivo de apoyo");
                  alTerminar();
                },
                onError: (e) => setError(e.message),
              })
            }
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Quitar
          </Button>
        </div>
      )}
      <Campo id="apoyo" etiqueta={actividad.apoyo ? "Reemplazar por otro archivo" : "Archivo"} descripcion="PDF, DOCX, JPG o PNG, hasta 10 MB">
        {(control) => (
          <Input {...control} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" className="h-auto py-2" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        )}
      </Campo>
      <ErrorGeneral mensaje={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={alTerminar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!archivo || subir.isPending}>
          {subir.isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}
          Adjuntar
        </Button>
      </DialogFooter>
    </form>
  );
}
