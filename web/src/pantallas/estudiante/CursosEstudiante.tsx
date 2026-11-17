import { BookOpen, CalendarClock, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router";
import { EstadoEntrega, Volver } from "@/components/academico/piezas";
import { EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { ProgresoSenda } from "@/components/marca/ProgresoSenda";
import { type CursoEstudiante, useActividadesEstudiante, useCursosEstudiante } from "@/lib/consultas";
import { fechaHora, TIPO_ACTIVIDAD } from "@/lib/formato";
import { ENTRADA } from "@/lib/movimiento";
import { useTituloPagina } from "@/sesion/useSesion";

// Cursos del estudiante y actividades de cada curso (tarea 4.4)

function ListaCursos({ cursos }: { cursos: CursoEstudiante[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {cursos.map((c) => (
        <li key={c.id}>
          <Link to={`/estudiante/cursos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
            <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.nombre}</span>
              <span className="block text-sm text-muted-foreground">
                Semestre {c.semestre}
                {c.docente && ` · ${c.docente.nombres} ${c.docente.apellidos}`}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MisCursosEstudiante() {
  useTituloPagina("Mis cursos");
  const consulta = useCursosEstudiante();
  const actuales = consulta.data?.filter((c) => c.actual) ?? [];
  const anteriores = consulta.data?.filter((c) => !c.actual) ?? [];

  return (
    <div className={`max-w-2xl space-y-6 ${ENTRADA}`}>
      <h1 className="text-3xl font-semibold tracking-tight">Mis cursos</h1>
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />
      {consulta.data?.length === 0 && <ListaVacia>Todavía no estás inscrito en ningún curso.</ListaVacia>}
      {actuales.length > 0 && <ListaCursos cursos={actuales} />}
      {anteriores.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-sans text-sm font-medium tracking-wide text-muted-foreground uppercase">Semestres anteriores</h2>
          <ListaCursos cursos={anteriores} />
        </section>
      )}
    </div>
  );
}

export function CursoEstudiante() {
  const id = Number(useParams().id);
  const cursos = useCursosEstudiante();
  const actividades = useActividadesEstudiante(id);
  const curso = cursos.data?.find((c) => c.id === id);
  useTituloPagina(curso?.nombre ?? "Curso");
  const entregadas = actividades.data?.filter((a) => a.entrega.estado !== "sin_entregar").length ?? 0;
  const total = actividades.data?.length ?? 0;

  return (
    <div className={`max-w-2xl space-y-6 ${ENTRADA}`}>
      <Volver a="/estudiante/cursos" texto="Mis cursos" />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{curso?.nombre ?? "Curso"}</h1>
        {curso?.docente && (
          <p className="text-muted-foreground">
            Semestre {curso.semestre} · {curso.docente.nombres} {curso.docente.apellidos}
          </p>
        )}
      </header>

      <EstadoConsulta cargando={actividades.isPending} error={actividades.error} alReintentar={() => void actividades.refetch()} />
      {actividades.data?.length === 0 && <ListaVacia>Este curso todavía no tiene actividades publicadas.</ListaVacia>}
      {total > 0 && (
        <div className="space-y-2">
          <ProgresoSenda total={total} completados={entregadas} etiqueta={`${entregadas} de ${total} actividades entregadas`} />
          <p className="text-sm text-muted-foreground">
            {entregadas} de {total} actividades entregadas
          </p>
        </div>
      )}
      {actividades.data && actividades.data.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {actividades.data.map((a) => (
            <li key={a.id}>
              <Link to={`/estudiante/actividades/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-medium">{a.titulo}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                    {TIPO_ACTIVIDAD[a.tipo]} · {fechaHora(a.fechaLimite)}
                  </span>
                  <EstadoEntrega entrega={a.entrega} />
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
