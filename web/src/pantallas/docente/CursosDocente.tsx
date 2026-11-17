import { BookOpen, ChevronRight, ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import { EstadoConsulta, ListaVacia } from "@/components/admin/piezas";
import { Badge } from "@/components/ui/badge";
import { useCursosDocente } from "@/lib/consultas";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Inicio y cursos del docente (tarea 4.4): sus cursos con lo que tiene por calificar

function ListaCursosDocente() {
  const consulta = useCursosDocente();
  return (
    <>
      <EstadoConsulta cargando={consulta.isPending} error={consulta.error} alReintentar={() => void consulta.refetch()} />
      {consulta.data?.length === 0 && <ListaVacia>Todavía no tienes cursos asignados.</ListaVacia>}
      {consulta.data && consulta.data.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card">
          {consulta.data.map((c) => (
            <li key={c.id}>
              <Link to={`/docente/cursos/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60">
                <BookOpen className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.nombre}</span>
                  <span className="block text-sm text-muted-foreground">
                    {c.carrera.codigo} · semestre {c.semestre} · {c.inscritos} estudiantes
                  </span>
                </span>
                {c.porCalificar > 0 && (
                  <Badge variant="alerta">
                    <ClipboardCheck aria-hidden="true" />
                    {c.porCalificar} por calificar
                  </Badge>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function InicioDocente() {
  useTituloPagina("Inicio");
  const { perfil } = useSesion();
  const cursos = useCursosDocente();
  const porCalificar = cursos.data?.reduce((total, c) => total + c.porCalificar, 0) ?? 0;

  return (
    <div className={`max-w-3xl space-y-6 ${ENTRADA}`}>
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Docente</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Hola, {perfil?.nombres}</h1>
        {cursos.data && (
          <p className="text-muted-foreground">
            {porCalificar === 0
              ? "No tienes entregas por calificar."
              : porCalificar === 1
                ? "Tienes 1 entrega por calificar."
                : `Tienes ${porCalificar} entregas por calificar.`}
          </p>
        )}
      </header>
      <ListaCursosDocente />
    </div>
  );
}

export function MisCursosDocente() {
  useTituloPagina("Mis cursos");
  return (
    <div className={`max-w-3xl space-y-6 ${ENTRADA}`}>
      <h1 className="text-3xl font-semibold tracking-tight">Mis cursos</h1>
      <ListaCursosDocente />
    </div>
  );
}
