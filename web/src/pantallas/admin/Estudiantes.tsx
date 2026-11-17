import { FileUp, Search, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { DialogoContrasena, MenuCuenta } from "@/components/admin/dialogos";
import { Encabezado, ErrorGeneral, EstadoActivo, EstadoCarteraBadge, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { type EstadoCartera, type Estudiante, useCambioCatalogo, useCarreras, useEstudiantes } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { TEXTO_ESTADO_CARTERA } from "@/lib/textos";
import { useRetardado } from "@/lib/useRetardado";
import { useTituloPagina } from "@/sesion/useSesion";
import { CargaMasiva } from "./CargaMasiva";
import { CamposPersona } from "./CamposPersona";
import { type DatosPersona, datosDe, PERSONA_VACIA } from "./persona";

const TODAS = "todas";

// Estudiantes (tarea 3.4; spec "Registro de estudiantes", "Consulta y búsqueda de estudiantes",
// "Inscripción automática" y "Desactivar y reactivar usuarios")
export default function Estudiantes() {
  useTituloPagina("Estudiantes");
  const carreras = useCarreras();
  const [busqueda, setBusqueda] = useState("");
  const [carrera, setCarrera] = useState(TODAS);
  const [estado, setEstado] = useState(TODAS);
  const q = useRetardado(busqueda.trim());
  const consulta = useEstudiantes({
    q: q || undefined,
    carrera: carrera === TODAS ? undefined : Number(carrera),
    estado: estado === TODAS ? undefined : (estado as EstadoCartera),
  });
  const [formulario, setFormulario] = useState<"nuevo" | Estudiante | null>(null);
  const [registrado, setRegistrado] = useState<{ estudiante: Estudiante; contrasena: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  const hayFiltros = q !== "" || carrera !== TODAS || estado !== TODAS;

  return (
    <Pagina>
      <Encabezado
        titulo="Estudiantes"
        descripcion="Registro, búsqueda y estado de cartera. Al registrar a un estudiante, queda inscrito en los cursos de su semestre."
        acciones={
          <>
            <Button size="lg" variant="outline" onClick={() => setCargando(true)}>
              <FileUp data-icon="inline-start" aria-hidden="true" />
              Cargar CSV
            </Button>
            <Button size="lg" onClick={() => setFormulario("nuevo")}>
              <UserPlus data-icon="inline-start" aria-hidden="true" />
              Registrar estudiante
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o documento"
            aria-label="Buscar por nombre o documento"
            className="pl-9"
          />
        </div>
        <Select value={carrera} onValueChange={setCarrera}>
          <SelectTrigger className="w-full" aria-label="Filtrar por carrera">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las carreras</SelectItem>
            {carreras.data?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.codigo} · {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="w-full" aria-label="Filtrar por estado de cartera">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos los estados</SelectItem>
            {(Object.keys(TEXTO_ESTADO_CARTERA) as EstadoCartera[]).map((e) => (
              <SelectItem key={e} value={e}>
                {TEXTO_ESTADO_CARTERA[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />
      {consulta.data && (
        <p className="text-sm text-muted-foreground" role="status">
          {consulta.data.length === 1 ? "1 estudiante" : `${consulta.data.length} estudiantes`}
          {hayFiltros && " con esos filtros"}
        </p>
      )}
      {consulta.data?.length === 0 && (
        <ListaVacia>{hayFiltros ? "Ningún estudiante coincide con la búsqueda." : "Todavía no hay estudiantes registrados."}</ListaVacia>
      )}
      {consulta.data && consulta.data.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead className="hidden lg:table-cell">Carrera</TableHead>
                <TableHead>Cartera</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.data.map((e) => (
                <TableRow key={e.id}>
                  {/* whitespace-normal: en el celular el nombre y el documento hacen salto de línea */}
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {e.nombres} {e.apellidos}
                      <EstadoActivo activo={e.activo} />
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {e.tipoDocumento} {e.documento}
                      <span className="lg:hidden">
                        {" "}
                        · {e.carrera.codigo} · semestre {e.semestreActual}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div>{e.carrera.codigo}</div>
                    <div className="text-sm text-muted-foreground">Semestre {e.semestreActual}</div>
                  </TableCell>
                  <TableCell>
                    <EstadoCarteraBadge estado={e.estadoCartera} />
                  </TableCell>
                  <TableCell>
                    <MenuCuenta persona={e} tipo="estudiante" alEditar={() => setFormulario(e)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formulario !== null} onOpenChange={(abierto) => !abierto && setFormulario(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {formulario !== null && (
            <FormularioEstudiante
              estudiante={formulario === "nuevo" ? null : formulario}
              alTerminar={(resultado) => {
                setFormulario(null);
                if (resultado) setRegistrado(resultado);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {registrado && (
        <DialogoContrasena persona={registrado.estudiante} contrasena={registrado.contrasena} alCerrar={() => setRegistrado(null)} />
      )}
      <CargaMasiva abierto={cargando} alCerrar={() => setCargando(false)} />
    </Pagina>
  );
}

type DatosAcademicos = { carreraId: string; semestre: string; cohorte: string; fechaIngreso: string };

// Valores por defecto de un registro nuevo: la cohorte y la fecha de hoy (enero a junio es el periodo 1)
function academicosNuevos(): DatosAcademicos {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return { carreraId: "", semestre: "1", cohorte: `${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 1 : 2}`, fechaIngreso: fecha };
}

function FormularioEstudiante({
  estudiante,
  alTerminar,
}: {
  estudiante: Estudiante | null;
  alTerminar: (registrado?: { estudiante: Estudiante; contrasena: string }) => void;
}) {
  const carreras = useCarreras();
  const [persona, setPersona] = useState<DatosPersona>(estudiante ? datosDe(estudiante) : PERSONA_VACIA);
  const [academicos, setAcademicos] = useState<DatosAcademicos>(
    estudiante
      ? {
          carreraId: String(estudiante.carrera.id),
          semestre: String(estudiante.semestreActual),
          cohorte: estudiante.cohorte,
          fechaIngreso: estudiante.fechaIngreso,
        }
      : academicosNuevos(),
  );
  const [errores, setErrores] = useState(SIN_ERRORES);
  const cambiar = (cambio: Partial<DatosAcademicos>) => setAcademicos((a) => ({ ...a, ...cambio }));

  // Solo carreras activas para asignaciones nuevas; la actual se muestra aunque esté inactiva
  const opciones = (carreras.data ?? []).filter((c) => c.activa || c.id === estudiante?.carrera.id);
  const elegida = carreras.data?.find((c) => String(c.id) === academicos.carreraId);

  const guardar = useCambioCatalogo(
    (cuerpo: Record<string, unknown>): Promise<{ estudiante: Estudiante; contrasena: string | null }> =>
      estudiante
        ? api.patch<Estudiante>(`/estudiantes/${estudiante.id}`, cuerpo).then((e) => ({ estudiante: e, contrasena: null }))
        : api
            .post<{ estudiante: Estudiante; contrasenaTemporal: string }>("/estudiantes", cuerpo)
            .then((r) => ({ estudiante: r.estudiante, contrasena: r.contrasenaTemporal })),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!academicos.carreraId) {
      setErrores({ campos: { carreraId: "Elige la carrera del estudiante" }, general: null });
      return;
    }
    setErrores(SIN_ERRORES);
    const comunes = { ...persona, carreraId: Number(academicos.carreraId), cohorte: academicos.cohorte, fechaIngreso: academicos.fechaIngreso };
    const cuerpo = estudiante
      ? { ...comunes, semestreActual: Number(academicos.semestre) }
      : { ...comunes, semestre: Number(academicos.semestre) };
    guardar.mutate(cuerpo, {
      onSuccess: ({ estudiante: guardado, contrasena }) => {
        if (contrasena) {
          alTerminar({ estudiante: guardado, contrasena });
        } else {
          toast.success(`Se guardaron los datos de ${guardado.nombres} ${guardado.apellidos}`);
          alTerminar();
        }
      },
      onError: (error) => setErrores(erroresDe(error, { semestreActual: "semestre" })),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{estudiante ? "Editar estudiante" : "Registrar estudiante"}</DialogTitle>
        <DialogDescription>
          {estudiante
            ? "Si cambias el semestre o la carrera, queda inscrito en los cursos nuevos y conserva sus notas anteriores."
            : "Queda inscrito en los cursos de su semestre. Al guardar verás su contraseña temporal una sola vez."}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <CamposPersona datos={persona} alCambiar={(cambio) => setPersona((p) => ({ ...p, ...cambio }))} errores={errores.campos} />
        <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Campo id="carreraId" etiqueta="Carrera" error={errores.campos.carreraId}>
            {(control) => (
              <Select value={academicos.carreraId} onValueChange={(valor) => cambiar({ carreraId: valor, semestre: "1" })}>
                <SelectTrigger {...control} className="w-full">
                  <SelectValue placeholder={carreras.isPending ? "Cargando carreras…" : "Elige la carrera"} />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} · {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>
          <Campo id="semestre" etiqueta="Semestre actual" error={errores.campos.semestre}>
            {(control) => (
              <Select value={academicos.semestre} onValueChange={(valor) => cambiar({ semestre: valor })} disabled={!elegida}>
                <SelectTrigger {...control} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: elegida?.duracionSemestres ?? 1 }, (_, i) => String(i + 1)).map((s) => (
                    <SelectItem key={s} value={s}>
                      Semestre {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Campo>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="cohorte" etiqueta="Cohorte" descripcion="Año y periodo, por ejemplo 2026-2" error={errores.campos.cohorte}>
            {(control) => <Input {...control} value={academicos.cohorte} onChange={(e) => cambiar({ cohorte: e.target.value })} required />}
          </Campo>
          <Campo id="fechaIngreso" etiqueta="Fecha de ingreso" error={errores.campos.fechaIngreso}>
            {(control) => (
              <Input {...control} type="date" value={academicos.fechaIngreso} onChange={(e) => cambiar({ fechaIngreso: e.target.value })} required />
            )}
          </Campo>
        </div>
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => alTerminar()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          {estudiante ? "Guardar cambios" : "Registrar estudiante"}
        </Button>
      </DialogFooter>
    </form>
  );
}
