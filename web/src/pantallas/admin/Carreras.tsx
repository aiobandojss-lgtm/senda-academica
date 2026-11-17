import { ChevronRight, GraduationCap, Pencil, Plus, Power } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Confirmar } from "@/components/admin/dialogos";
import { Encabezado, ErrorGeneral, EstadoActivo, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { type Carrera, useCambioCatalogo, useCarreras } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { useTituloPagina } from "@/sesion/useSesion";

// Carreras (tarea 3.4; spec `carreras-estudiantes`, "Catálogo de carreras"). Cada carrera lleva a sus cursos.
export default function Carreras() {
  useTituloPagina("Carreras y cursos");
  const consulta = useCarreras();
  const [formulario, setFormulario] = useState<"nueva" | Carrera | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Carrera | null>(null);

  const cambiarEstado = useCambioCatalogo((c: Carrera) => api.patch<Carrera>(`/carreras/${c.id}`, { activa: !c.activa }));
  const confirmarEstado = () => {
    if (!cambiandoEstado) return;
    cambiarEstado.mutate(cambiandoEstado, {
      onSuccess: (c) => {
        setCambiandoEstado(null);
        toast.success(c.activa ? `La carrera ${c.codigo} quedó activa` : `La carrera ${c.codigo} quedó desactivada`);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Pagina>
      <Encabezado
        titulo="Carreras y cursos"
        descripcion="Cada carrera agrupa sus cursos por semestre. Entra a una carrera para crear sus cursos y asignar docentes."
        acciones={
          <Button size="lg" onClick={() => setFormulario("nueva")}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Nueva carrera
          </Button>
        }
      />

      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />
      {consulta.data?.length === 0 && <ListaVacia>Todavía no hay carreras. Crea la primera.</ListaVacia>}
      <div className="grid gap-4 md:grid-cols-2">
        {consulta.data?.map((c) => (
          <Card key={c.id}>
            <CardHeader className="gap-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium tracking-wide text-foreground">{c.codigo}</span>
                <span aria-hidden="true">·</span>
                <span>{c.duracionSemestres} semestres</span>
                <EstadoActivo activo={c.activa} femenino />
              </div>
              <CardTitle className="text-lg leading-snug">{c.nombre}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6 text-sm">
              <p>
                <span className="block text-2xl font-semibold tabular-nums">{c.estudiantesActivos}</span>
                <span className="text-muted-foreground">estudiantes activos</span>
              </p>
              <p>
                <span className="block text-2xl font-semibold tabular-nums">{c.cursosActivos}</span>
                <span className="text-muted-foreground">cursos activos</span>
              </p>
            </CardContent>
            <CardFooter className="mt-auto flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`/admin/carreras/${c.id}`}>
                  <GraduationCap data-icon="inline-start" aria-hidden="true" />
                  Ver cursos
                  <ChevronRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setFormulario(c)}>
                <Pencil data-icon="inline-start" aria-hidden="true" />
                Editar
              </Button>
              <Button variant="ghost" onClick={() => setCambiandoEstado(c)}>
                <Power data-icon="inline-start" aria-hidden="true" />
                {c.activa ? "Desactivar" : "Activar"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={formulario !== null} onOpenChange={(abierto) => !abierto && setFormulario(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          {formulario !== null && <FormularioCarrera carrera={formulario === "nueva" ? null : formulario} alTerminar={() => setFormulario(null)} />}
        </DialogContent>
      </Dialog>
      <Confirmar
        abierto={cambiandoEstado !== null}
        alCambiar={(abierto) => !abierto && setCambiandoEstado(null)}
        titulo={cambiandoEstado?.activa ? `¿Desactivar ${cambiandoEstado.codigo}?` : `¿Activar ${cambiandoEstado?.codigo}?`}
        descripcion={
          cambiandoEstado?.activa
            ? "Dejará de aceptar cursos y estudiantes nuevos. Sus estudiantes y cursos actuales conservan su información."
            : "Volverá a aceptar cursos y estudiantes nuevos."
        }
        accion={cambiandoEstado?.activa ? "Desactivar carrera" : "Activar carrera"}
        peligro={cambiandoEstado?.activa}
        pendiente={cambiarEstado.isPending}
        alConfirmar={confirmarEstado}
      />
    </Pagina>
  );
}

type DatosCarrera = { codigo: string; nombre: string; descripcion: string; duracionSemestres: string };

function FormularioCarrera({ carrera, alTerminar }: { carrera: Carrera | null; alTerminar: () => void }) {
  const [datos, setDatos] = useState<DatosCarrera>({
    codigo: carrera?.codigo ?? "",
    nombre: carrera?.nombre ?? "",
    descripcion: carrera?.descripcion ?? "",
    duracionSemestres: String(carrera?.duracionSemestres ?? 4),
  });
  const [errores, setErrores] = useState(SIN_ERRORES);
  const cambiar = (cambio: Partial<DatosCarrera>) => setDatos((d) => ({ ...d, ...cambio }));

  const guardar = useCambioCatalogo((cuerpo: Omit<DatosCarrera, "duracionSemestres"> & { duracionSemestres: number }) =>
    carrera ? api.patch<Carrera>(`/carreras/${carrera.id}`, cuerpo) : api.post<Carrera>("/carreras", cuerpo),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    guardar.mutate(
      { ...datos, duracionSemestres: Number(datos.duracionSemestres) },
      {
        onSuccess: (c) => {
          toast.success(carrera ? `Se guardó la carrera ${c.codigo}` : `Se creó la carrera ${c.codigo}`);
          alTerminar();
        },
        onError: (error) => setErrores(erroresDe(error)),
      },
    );
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{carrera ? "Editar carrera" : "Nueva carrera"}</DialogTitle>
        <DialogDescription>El código es único. Se guarda en mayúsculas, por ejemplo TL-PSW.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Campo id="codigo" etiqueta="Código" error={errores.campos.codigo}>
            {(control) => (
              <Input {...control} value={datos.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} autoCapitalize="characters" required />
            )}
          </Campo>
          <Campo id="duracionSemestres" etiqueta="Semestres" error={errores.campos.duracionSemestres}>
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={datos.duracionSemestres}
                onChange={(e) => cambiar({ duracionSemestres: e.target.value })}
                required
              />
            )}
          </Campo>
        </div>
        <Campo id="nombre" etiqueta="Nombre" error={errores.campos.nombre}>
          {(control) => <Input {...control} value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} required />}
        </Campo>
        <Campo id="descripcion" etiqueta="Descripción (opcional)" error={errores.campos.descripcion}>
          {(control) => <Textarea {...control} value={datos.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} rows={3} />}
        </Campo>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={alTerminar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          {carrera ? "Guardar cambios" : "Crear carrera"}
        </Button>
      </DialogFooter>
    </form>
  );
}
