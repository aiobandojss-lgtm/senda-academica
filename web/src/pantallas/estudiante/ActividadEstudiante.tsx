import { CalendarClock, Download, FileText, Lock, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { EstadoEntrega, Volver } from "@/components/academico/piezas";
import { ErrorGeneral, EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { Campo } from "@/components/formularios/Campo";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ErrorApi } from "@/lib/api";
import { type Entrega, useActividadEstudiante, useCambio, useCursosEstudiante } from "@/lib/consultas";
import { fechaHora, nota, TIPO_ACTIVIDAD, vencida } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useTituloPagina } from "@/sesion/useSesion";

const TAMANO_MAXIMO = 10 * 1024 * 1024;
const ACEPTA = ".pdf,.docx,.jpg,.jpeg,.png";

// Actividad del estudiante (tarea 4.4; spec "Entrega de archivos", "Reemplazo de la entrega" y "Calificación")
export default function ActividadEstudiante() {
  const id = Number(useParams().id);
  const consulta = useActividadEstudiante(id);
  const cursos = useCursosEstudiante();
  const actividad = consulta.data;
  const curso = cursos.data?.find((c) => c.id === actividad?.cursoId);
  useTituloPagina(actividad?.titulo ?? "Actividad");

  if (consulta.error instanceof ErrorApi && consulta.error.estado === 404) {
    return (
      <div className="max-w-2xl space-y-4">
        <ListaVacia>Esta actividad no existe o todavía no está publicada.</ListaVacia>
        <Volver a="/estudiante" texto="Inicio" />
      </div>
    );
  }

  return (
    <div className={`max-w-2xl space-y-6 ${ENTRADA}`}>
      {curso ? <Volver a={`/estudiante/cursos/${curso.id}`} texto={curso.nombre} /> : <Volver a="/estudiante" texto="Inicio" />}
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />

      {actividad && (
        <>
          <header className="space-y-2">
            <p className="text-sm font-medium tracking-wide text-accent-foreground uppercase">{TIPO_ACTIVIDAD[actividad.tipo]}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{actividad.titulo}</h1>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              {vencida(actividad.fechaLimite) ? "Venció el " : "Fecha límite: "}
              {fechaHora(actividad.fechaLimite)}
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Instrucciones</h2>
            <p className="leading-relaxed whitespace-pre-line">{actividad.instrucciones}</p>
            {actividad.apoyo && (
              <Button variant="outline" asChild>
                {/* Enlace normal: el navegador envía la cookie y la API entrega el archivo como descarga */}
                <a href={`/api/archivos/apoyos/${actividad.id}`}>
                  <FileText data-icon="inline-start" aria-hidden="true" />
                  Descargar archivo de apoyo ({actividad.apoyo.formato.toUpperCase()})
                </a>
              </Button>
            )}
          </section>

          <TuEntrega actividadId={actividad.id} entrega={actividad.entrega} vencida={vencida(actividad.fechaLimite)} />
        </>
      )}
    </div>
  );
}

function TuEntrega({ actividadId, entrega, vencida: yaVencio }: { actividadId: number; entrega: Entrega; vencida: boolean }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subir = useCambio((elegido: File) => api.subirArchivo<Entrega>("POST", `/actividades/${actividadId}/entrega`, elegido));
  const calificada = entrega.estado === "calificada";

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!archivo) return;
    // Antes de gastar datos móviles en una subida que la API va a rechazar
    if (archivo.size > TAMANO_MAXIMO) {
      setError("El archivo pesa más de 10 MB, el máximo permitido");
      return;
    }
    setError(null);
    // Se guarda ya: cuando llegue la respuesta, evento.currentTarget valdrá null
    const formulario = evento.currentTarget;
    subir.mutate(archivo, {
      onSuccess: (resultado) => {
        setArchivo(null);
        formulario.reset();
        toast.success(resultado.tardia ? "Recibimos tu entrega. Quedó marcada como tardía." : "Recibimos tu entrega.");
      },
      onError: (e) => setError(e.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tu entrega</CardTitle>
        <CardAction>
          <EstadoEntrega entrega={entrega} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        {entrega.id && entrega.nombreArchivo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-medium">{entrega.nombreArchivo}</span>
              {entrega.entregadoEn && <span className="block text-sm text-muted-foreground">Entregada el {fechaHora(entrega.entregadoEn)}</span>}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/archivos/entregas/${entrega.id}`}>
                <Download data-icon="inline-start" aria-hidden="true" />
                Descargar
              </a>
            </Button>
          </div>
        )}

        {calificada && (
          <div className="space-y-2">
            <p className="flex items-baseline gap-2">
              <span className="font-heading text-4xl font-semibold tabular-nums">{nota(entrega.nota ?? 0)}</span>
              <span className="text-muted-foreground">de 5,0</span>
            </p>
            {entrega.comentario && <p className="leading-relaxed whitespace-pre-line">{entrega.comentario}</p>}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden="true" />
              Ya fue calificada: no se puede reemplazar.
            </p>
          </div>
        )}

        {!calificada && (
          <form onSubmit={alEnviar} className="space-y-4">
            {yaVencio && <p className="text-sm">La fecha límite ya pasó: puedes entregar, pero quedará marcada como tardía.</p>}
            <Campo
              id="archivo"
              etiqueta={entrega.id ? "Reemplazar por otro archivo" : "Archivo"}
              descripcion="PDF, DOCX, JPG o PNG, hasta 10 MB"
            >
              {(control) => (
                <Input
                  {...control}
                  type="file"
                  accept={ACEPTA}
                  className="h-auto py-2"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                />
              )}
            </Campo>
            <ErrorGeneral mensaje={error} />
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!archivo || subir.isPending}>
              {subir.isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Upload data-icon="inline-start" aria-hidden="true" />}
              {subir.isPending ? "Subiendo…" : entrega.id ? "Reemplazar mi entrega" : "Subir mi entrega"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
