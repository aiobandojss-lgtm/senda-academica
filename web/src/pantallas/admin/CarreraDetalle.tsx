import { ArrowLeft, EllipsisVertical, Pencil, Plus, Power } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Confirmar } from "@/components/admin/dialogos";
import { Encabezado, ErrorGeneral, EstadoActivo, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { type Carrera, type Curso, useCambioCatalogo, useCarreras, useCursos, useDocentes } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { useTituloPagina } from "@/sesion/useSesion";

// Cursos de una carrera (tarea 3.4; spec "Cursos por carrera" y "Edición de cursos"). Al crear un curso, la
// API inscribe a los estudiantes activos de ese semestre (D15).
export default function CarreraDetalle() {
  const id = Number(useParams().id);
  const carreras = useCarreras();
  const carrera = carreras.data?.find((c) => c.id === id);
  useTituloPagina(carrera ? `Cursos de ${carrera.codigo}` : "Cursos");
  const cursos = useCursos(id);
  const [formulario, setFormulario] = useState<"nuevo" | Curso | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Curso | null>(null);

  const cambiarEstado = useCambioCatalogo((c: Curso) => api.patch<Curso>(`/cursos/${c.id}`, { activo: !c.activo }));
  const confirmarEstado = () => {
    if (!cambiandoEstado) return;
    cambiarEstado.mutate(cambiandoEstado, {
      onSuccess: (c) => {
        setCambiandoEstado(null);
        toast.success(c.activo ? `El curso ${c.nombre} quedó activo, con ${c.inscritos} estudiantes inscritos` : `El curso ${c.nombre} quedó desactivado`);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  if (carreras.data && !carrera) {
    return (
      <Pagina>
        <ListaVacia>Esa carrera no existe.</ListaVacia>
        <VolverACarreras />
      </Pagina>
    );
  }

  return (
    <Pagina>
      <VolverACarreras />
      <Encabezado
        titulo={carrera ? carrera.nombre : "Cursos"}
        descripcion={carrera ? `${carrera.codigo} · ${carrera.duracionSemestres} semestres · ${carrera.estudiantesActivos} estudiantes activos` : undefined}
        acciones={
          carrera?.activa && (
            <Button size="lg" onClick={() => setFormulario("nuevo")}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              Nuevo curso
            </Button>
          )
        }
      />
      {carrera && !carrera.activa && (
        <p className="text-muted-foreground">La carrera está desactivada: no acepta cursos nuevos. Actívala desde la lista de carreras.</p>
      )}

      <EstadoConsulta
        cargando={cursos.isPending || carreras.isPending}
        error={cursos.error ?? carreras.error}
        alReintentar={() => void Promise.all([cursos.refetch(), carreras.refetch()])}
      />
      {cursos.data?.length === 0 && <ListaVacia>Esta carrera todavía no tiene cursos.</ListaVacia>}
      {cursos.data && cursos.data.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 sm:w-24">
                  <abbr title="Semestre" className="no-underline sm:hidden">Sem.</abbr>
                  <span className="hidden sm:inline">Semestre</span>
                </TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="hidden md:table-cell">Docente</TableHead>
                <TableHead className="text-right">Inscritos</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...cursos.data]
                .sort((a, b) => a.semestre - b.semestre || a.nombre.localeCompare(b.nombre, "es"))
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums">{c.semestre}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {c.nombre}
                        <EstadoActivo activo={c.activo} />
                      </div>
                      {/* En el celular, el docente va debajo del curso */}
                      <div className="text-sm text-muted-foreground md:hidden">{nombreDocente(c)}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex flex-wrap items-center gap-2">
                        {nombreDocente(c)}
                        {c.docente && !c.docente.activo && <EstadoActivo activo={false} />}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.inscritos}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Acciones de ${c.nombre}`}>
                            <EllipsisVertical aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setFormulario(c)}>
                            <Pencil aria-hidden="true" />
                            Editar nombre o docente
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant={c.activo ? "destructive" : "default"}
                            onSelect={() => setCambiandoEstado(c)}
                          >
                            <Power aria-hidden="true" />
                            {c.activo ? "Desactivar" : "Reactivar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formulario !== null && !!carrera} onOpenChange={(abierto) => !abierto && setFormulario(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          {formulario !== null && carrera && (
            <FormularioCurso carrera={carrera} curso={formulario === "nuevo" ? null : formulario} alTerminar={() => setFormulario(null)} />
          )}
        </DialogContent>
      </Dialog>
      <Confirmar
        abierto={cambiandoEstado !== null}
        alCambiar={(abierto) => !abierto && setCambiandoEstado(null)}
        titulo={cambiandoEstado?.activo ? `¿Desactivar ${cambiandoEstado.nombre}?` : `¿Reactivar ${cambiandoEstado?.nombre}?`}
        descripcion={
          cambiandoEstado?.activo
            ? "Sus estudiantes conservan la inscripción, las entregas y las notas."
            : "Se inscriben los estudiantes activos de su semestre que todavía no lo estén."
        }
        accion={cambiandoEstado?.activo ? "Desactivar curso" : "Reactivar curso"}
        peligro={cambiandoEstado?.activo}
        pendiente={cambiarEstado.isPending}
        alConfirmar={confirmarEstado}
      />
    </Pagina>
  );
}

const nombreDocente = (c: Curso) => (c.docente ? `${c.docente.nombres} ${c.docente.apellidos}` : "Sin docente");

function VolverACarreras() {
  return (
    <Button variant="link" asChild className="-ml-4 h-auto px-4 py-1">
      <Link to="/admin/carreras">
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Carreras
      </Link>
    </Button>
  );
}

// Al crear: nombre, semestre y docente. Al editar: nombre y docente; el semestre no cambia (spec "Edición de cursos")
function FormularioCurso({ carrera, curso, alTerminar }: { carrera: Carrera; curso: Curso | null; alTerminar: () => void }) {
  const docentes = useDocentes();
  const [nombre, setNombre] = useState(curso?.nombre ?? "");
  const [semestre, setSemestre] = useState(curso ? String(curso.semestre) : "1");
  const [docenteId, setDocenteId] = useState(curso?.docente ? String(curso.docente.id) : "");
  const [errores, setErrores] = useState(SIN_ERRORES);

  // Solo docentes activos se pueden asignar; el actual se muestra aunque esté inactivo, para no perderlo de vista
  const opciones = (docentes.data ?? []).filter((d) => d.activo || d.id === curso?.docente?.id);

  const guardar = useCambioCatalogo((cuerpo: Record<string, unknown>) =>
    curso ? api.patch<Curso>(`/cursos/${curso.id}`, cuerpo) : api.post<Curso>("/cursos", cuerpo),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!docenteId) {
      setErrores({ campos: { docenteId: "Elige el docente del curso" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    const cuerpo = curso
      ? { nombre, docenteId: Number(docenteId) }
      : { carreraId: carrera.id, nombre, semestre: Number(semestre), docenteId: Number(docenteId) };
    guardar.mutate(cuerpo, {
      onSuccess: (c) => {
        toast.success(curso ? `Se guardó ${c.nombre}` : `Se creó ${c.nombre} con ${c.inscritos} estudiantes inscritos`);
        alTerminar();
      },
      onError: (error) => setErrores(erroresDe(error)),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{curso ? "Editar curso" : `Nuevo curso de ${carrera.codigo}`}</DialogTitle>
        <DialogDescription>
          {curso
            ? "La carrera y el semestre no se pueden cambiar. Si están mal, desactiva el curso y crea otro."
            : "Al crearlo, se inscriben los estudiantes activos de ese semestre."}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Campo id="nombre" etiqueta="Nombre del curso" error={errores.campos.nombre}>
          {(control) => <Input {...control} value={nombre} onChange={(e) => setNombre(e.target.value)} required />}
        </Campo>
        <Campo id="semestre" etiqueta="Semestre" error={errores.campos.semestre}>
          {(control) => (
            <Select value={semestre} onValueChange={setSemestre} disabled={curso !== null}>
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: carrera.duracionSemestres }, (_, i) => String(i + 1)).map((s) => (
                  <SelectItem key={s} value={s}>
                    Semestre {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
        <Campo id="docenteId" etiqueta="Docente" error={errores.campos.docenteId}>
          {(control) => (
            <Select value={docenteId} onValueChange={setDocenteId} disabled={docentes.isPending}>
              <SelectTrigger {...control} className="w-full">
                <SelectValue placeholder={docentes.isPending ? "Cargando docentes…" : "Elige un docente"} />
              </SelectTrigger>
              <SelectContent>
                {opciones.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.nombres} {d.apellidos}
                    {!d.activo && " (inactivo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={alTerminar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          {curso ? "Guardar cambios" : "Crear curso"}
        </Button>
      </DialogFooter>
    </form>
  );
}
