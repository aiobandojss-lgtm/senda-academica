import { BookOpen, CalendarClock, ChevronRight, PartyPopper, Upload } from "lucide-react";
import { Link } from "react-router";
import { EstadoConsulta } from "@/components/admin/piezas";
import { ProgresoSenda } from "@/components/marca/ProgresoSenda";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCursosEstudiante, usePendientes } from "@/lib/consultas";
import { fechaHora, TIPO_ACTIVIDAD, vencida } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Inicio del estudiante (tarea 4.4): lo primero que ve desde el celular es su próxima entrega y su avance,
// como en la composición de docs/identidad-visual.md. El estado de cuenta se suma en la tarea 5.5.
export default function InicioEstudiante() {
  useTituloPagina("Inicio");
  const { perfil } = useSesion();
  const pendientes = usePendientes();
  const cursos = useCursosEstudiante();
  const actuales = cursos.data?.filter((c) => c.actual) ?? [];
  const [proxima, ...otras] = pendientes.data?.pendientes ?? [];

  return (
    <div className={`max-w-2xl space-y-6 ${ENTRADA}`}>
      <header className="space-y-1">
        {actuales[0] && (
          <p className="text-sm text-muted-foreground">
            Semestre {actuales[0].semestre} · {actuales[0].carrera.nombre}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Hola, {perfil?.nombres}</h1>
      </header>

      <EstadoConsulta cargando={pendientes.isPending} error={pendientes.error} alReintentar={() => void pendientes.refetch()} />

      {pendientes.data && proxima && (
        <Card>
          <CardHeader className="gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-accent-foreground">
              <CalendarClock className="size-4" aria-hidden="true" />
              {TIPO_ACTIVIDAD[proxima.tipo]} · {vencida(proxima.fechaLimite) ? "venció el " : "vence el "}
              {fechaHora(proxima.fechaLimite)}
            </p>
            <CardTitle className="text-xl leading-snug">{proxima.titulo}</CardTitle>
            <p className="text-sm text-muted-foreground">{proxima.curso.nombre}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <ProgresoSenda
                total={pendientes.data.publicadas}
                completados={pendientes.data.entregadas}
                etiqueta={`${pendientes.data.entregadas} de ${pendientes.data.publicadas} actividades entregadas`}
              />
              <p className="text-sm text-muted-foreground">
                {pendientes.data.entregadas} de {pendientes.data.publicadas} actividades entregadas este semestre
              </p>
            </div>
            {vencida(proxima.fechaLimite) && (
              <p className="text-sm">Todavía puedes entregarla: quedará marcada como tardía.</p>
            )}
            <Button size="lg" className="w-full" asChild>
              <Link to={`/estudiante/actividades/${proxima.id}`}>
                <Upload data-icon="inline-start" aria-hidden="true" />
                Subir mi entrega
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {pendientes.data && !proxima && (
        <Card>
          <CardContent className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Estás al día con tus entregas</p>
              <p className="text-sm text-muted-foreground">
                {pendientes.data.publicadas > 0
                  ? `Entregaste las ${pendientes.data.publicadas} actividades publicadas de este semestre.`
                  : "Tus docentes todavía no han publicado actividades."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {otras.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans text-sm font-medium tracking-wide text-muted-foreground uppercase">También pendientes</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {otras.map((a) => (
              <li key={a.id}>
                <Link to={`/estudiante/actividades/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{a.titulo}</span>
                    <span className="block text-sm text-muted-foreground">
                      {a.curso.nombre} · {vencida(a.fechaLimite) ? "venció el " : "vence el "}
                      {fechaHora(a.fechaLimite)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actuales.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans text-sm font-medium tracking-wide text-muted-foreground uppercase">Mis cursos</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {actuales.map((c) => (
              <li key={c.id}>
                <Link to={`/estudiante/cursos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                  <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.nombre}</span>
                    {c.docente && (
                      <span className="block text-sm text-muted-foreground">
                        {c.docente.nombres} {c.docente.apellidos}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
