import { UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { DialogoContrasena, MenuCuenta } from "@/components/admin/dialogos";
import { Encabezado, ErrorGeneral, EstadoActivo, EstadoConsulta, ListaVacia, Pagina } from "@/components/admin/piezas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { type Docente, useCambioCatalogo, useDocentes } from "@/lib/consultas";
import { erroresDe, SIN_ERRORES } from "@/lib/errores-formulario";
import { useTituloPagina } from "@/sesion/useSesion";
import { CamposPersona } from "./CamposPersona";
import { type DatosPersona, datosDe, PERSONA_VACIA } from "./persona";

// Docentes (tarea 3.4; spec `carreras-estudiantes`, "Registro de docentes" y "Desactivar y reactivar usuarios")
export default function Docentes() {
  useTituloPagina("Docentes");
  const consulta = useDocentes();
  // null: cerrado; "nuevo": registrar; un docente: editar
  const [formulario, setFormulario] = useState<"nuevo" | Docente | null>(null);
  const [registrado, setRegistrado] = useState<{ docente: Docente; contrasena: string } | null>(null);

  return (
    <Pagina>
      <Encabezado
        titulo="Docentes"
        descripcion="Cuentas de los docentes. Al registrar uno, recibe una contraseña temporal."
        acciones={
          <Button size="lg" onClick={() => setFormulario("nuevo")}>
            <UserPlus data-icon="inline-start" aria-hidden="true" />
            Registrar docente
          </Button>
        }
      />

      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />
      {consulta.data?.length === 0 && <ListaVacia>Todavía no hay docentes registrados.</ListaVacia>}
      {consulta.data && consulta.data.length > 0 && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Docente</TableHead>
                <TableHead className="hidden md:table-cell">Correo</TableHead>
                <TableHead className="text-right">Cursos activos</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {d.nombres} {d.apellidos}
                      <EstadoActivo activo={d.activo} />
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {d.tipoDocumento} {d.documento}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{d.correo}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.cursosActivos}</TableCell>
                  <TableCell>
                    <MenuCuenta persona={d} tipo="docente" alEditar={() => setFormulario(d)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formulario !== null} onOpenChange={(abierto) => !abierto && setFormulario(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          {formulario !== null && (
            <FormularioDocente
              docente={formulario === "nuevo" ? null : formulario}
              alTerminar={(resultado) => {
                setFormulario(null);
                if (resultado) setRegistrado(resultado);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {registrado && (
        <DialogoContrasena persona={registrado.docente} contrasena={registrado.contrasena} alCerrar={() => setRegistrado(null)} />
      )}
    </Pagina>
  );
}

// Vive dentro del diálogo: se monta al abrirlo, así cada apertura empieza con los datos correctos
function FormularioDocente({
  docente,
  alTerminar,
}: {
  docente: Docente | null;
  alTerminar: (registrado?: { docente: Docente; contrasena: string }) => void;
}) {
  const [datos, setDatos] = useState<DatosPersona>(docente ? datosDe(docente) : PERSONA_VACIA);
  const [errores, setErrores] = useState(SIN_ERRORES);

  // Registrar devuelve la contraseña temporal; editar, no
  const guardar = useCambioCatalogo((cuerpo: DatosPersona): Promise<{ docente: Docente; contrasena: string | null }> =>
    docente
      ? api.patch<Docente>(`/docentes/${docente.id}`, cuerpo).then((d) => ({ docente: d, contrasena: null }))
      : api.post<{ docente: Docente; contrasenaTemporal: string }>("/docentes", cuerpo).then((r) => ({
          docente: r.docente,
          contrasena: r.contrasenaTemporal,
        })),
  );

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    guardar.mutate(datos, {
      onSuccess: ({ docente: guardado, contrasena }) => {
        if (contrasena) {
          alTerminar({ docente: guardado, contrasena });
        } else {
          toast.success(`Se guardaron los datos de ${guardado.nombres} ${guardado.apellidos}`);
          alTerminar();
        }
      },
      onError: (error) => setErrores(erroresDe(error)),
    });
  };

  return (
    <form onSubmit={alEnviar} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{docente ? "Editar docente" : "Registrar docente"}</DialogTitle>
        <DialogDescription>
          {docente
            ? "Si cambias el documento, cambia también su usuario para ingresar."
            : "Al guardar verás su contraseña temporal una sola vez."}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <CamposPersona datos={datos} alCambiar={(cambio) => setDatos((d) => ({ ...d, ...cambio }))} errores={errores.campos} />
      </FieldGroup>
      <ErrorGeneral mensaje={errores.general} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => alTerminar()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          {docente ? "Guardar cambios" : "Registrar docente"}
        </Button>
      </DialogFooter>
    </form>
  );
}
