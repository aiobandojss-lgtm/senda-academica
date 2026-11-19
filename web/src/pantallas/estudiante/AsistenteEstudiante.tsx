import { BookOpen, CalendarClock, CircleAlert, Clock, ListTodo, SendHorizontal, ShieldAlert, Trash2, Wallet } from "lucide-react";
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EstadoConsulta } from "@/components/admin/piezas";
import { SimboloSenda } from "@/components/marca/SimboloSenda";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ErrorApi } from "@/lib/api";
import { type MensajeAsistente, useBorrarConversacion, useConversacion, usePreguntarAsistente } from "@/lib/consultas";
import { ENTRADA } from "@/lib/movimiento";
import { analizarRespuesta, type FuenteAsistente, type Segmento, textoDeFuente } from "@/lib/respuesta-asistente";
import { cn } from "@/lib/utils";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";

// Asistente Senda del estudiante (RAG tarea 3.4; spec `asistente-academico`). Todo sale de la API: la conversación
// guardada en el servidor (D8), las preguntas que le quedan hoy (D9) y cada respuesta con sus fuentes. El navegador
// solo envía la pregunta nueva. Si el estudiante está bloqueado por mora, la API responde ACCESO_SUSPENDIDO y la
// sesión lo saca de aquí, como en el resto de la plataforma.

// El mismo máximo que valida la API (api/src/rutas/asistente.ts)
const MAXIMO_CARACTERES = 500;

// Preguntas para empezar: son textos de la interfaz, no datos. Las respuestas siempre salen de la API. Cada una pide
// una sola cosa: con "¿Cuánto debo y cuándo vence mi próxima cuota?" el modelo respondió el valor de la próxima cuota
// como si fuera el total (prueba real de la tarea 3.4)
const SUGERENCIAS = [
  { texto: "¿Cuál es la nota mínima para aprobar un curso?", Icono: BookOpen },
  { texto: "¿Qué actividades tengo pendientes?", Icono: ListTodo },
  { texto: "¿Cuánto debo en total?", Icono: Wallet },
  { texto: "¿Qué pasa si entrego un taller tarde?", Icono: Clock },
];

export default function AsistenteEstudiante() {
  useTituloPagina("Asistente académico");
  const { perfil, config } = useSesion();
  const conversacion = useConversacion();
  const preguntar = usePreguntarAsistente();
  const borrar = useBorrarConversacion();
  const [borrador, setBorrador] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fin = useRef<HTMLDivElement>(null);
  const primeraCarga = useRef(true);

  const producto = config.productoNombre;
  const mensajes = conversacion.data?.mensajes ?? [];
  const restantes = conversacion.data?.preguntasRestantes;
  const sinPreguntas = restantes === 0;
  // La pregunta en camino: se muestra de una vez, aunque el servidor todavía no la haya guardado
  const pendiente = preguntar.isPending ? preguntar.variables : undefined;

  // Al llegar un mensaje o salir una pregunta, la vista baja hasta el final (sin animación la primera vez o si la
  // persona pidió reducir movimiento)
  useEffect(() => {
    if (!conversacion.data) return;
    const instantaneo = primeraCarga.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    primeraCarga.current = false;
    // Una conversación vacía se ve desde arriba: el saludo y las preguntas sugeridas
    if (conversacion.data.mensajes.length === 0 && !pendiente) return;
    fin.current?.scrollIntoView({ block: "end", behavior: instantaneo ? "auto" : "smooth" });
  }, [conversacion.data, pendiente]);

  function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || preguntar.isPending || sinPreguntas) return;
    setBorrador("");
    preguntar.mutate(pregunta, {
      // Sin respuesta, la pregunta vuelve al campo para intentarlo de nuevo: no se guardó ni contó para el límite (D11)
      onError: () => setBorrador((actual) => actual || pregunta),
    });
  }

  // Enter envía; Mayúscula + Enter hace un salto de línea
  function alPresionarTecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar(borrador);
    }
  }

  function borrarConversacion() {
    borrar.mutate(undefined, {
      onSuccess: () => toast.success("Borraste tu conversación"),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    // Ocupa el alto de la pantalla (menos la barra superior del celular y el margen de arriba) para que el campo de
    // la pregunta quede abajo aunque la conversación sea corta; el margen negativo anula el de abajo del layout
    <div className={cn("-mb-8 flex min-h-[calc(100dvh-5.5rem)] max-w-3xl flex-col md:-mb-10 md:min-h-[calc(100dvh-2.5rem)]", ENTRADA)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Asistente académico</h1>
          <p className="text-muted-foreground">Pregúntale a {producto} por el reglamento, el calendario, tus notas o tu estado de cuenta.</p>
        </div>
        {mensajes.length > 0 && (
          <Button variant="outline" onClick={() => setConfirmarBorrado(true)} disabled={borrar.isPending || preguntar.isPending}>
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Borrar conversación
          </Button>
        )}
      </header>

      <div className="flex-1 space-y-6 py-6">
        <EstadoConsulta cargando={conversacion.isPending} error={conversacion.error} alReintentar={() => void conversacion.refetch()} />

        {conversacion.data && mensajes.length === 0 && !pendiente && (
          <Bienvenida
            nombrePila={perfil?.nombres.trim().split(/\s+/)[0] ?? ""}
            producto={producto}
            fundacion={config.fundacionNombre}
            deshabilitada={sinPreguntas}
            alElegir={enviar}
          />
        )}

        {/* role="log": el lector de pantalla anuncia cada mensaje nuevo sin interrumpir */}
        <div role="log" aria-label={`Conversación con ${producto}`} className="space-y-6">
          {mensajes.map((mensaje) =>
            mensaje.rol === "usuario" ? (
              <MensajeEstudiante key={mensaje.id} texto={mensaje.contenido} />
            ) : (
              <MensajeDelAsistente key={mensaje.id} mensaje={mensaje} producto={producto} />
            ),
          )}
          {pendiente && (
            <>
              <MensajeEstudiante texto={pendiente} />
              <Buscando producto={producto} />
            </>
          )}
        </div>
      </div>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(borrador);
        }}
        className="sticky bottom-0 z-10 space-y-2 bg-background pt-2 pb-4 md:pb-6"
      >
        {/* Desvanece la conversación al pasar por detrás del campo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-background to-transparent" />
        <AvisoDelEnvio error={preguntar.error} sinPreguntas={sinPreguntas} />
        <div className="flex items-end gap-2">
          <Label htmlFor="pregunta" className="sr-only">
            Tu pregunta para {producto}
          </Label>
          <Textarea
            ref={campo}
            id="pregunta"
            rows={1}
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            onKeyDown={alPresionarTecla}
            maxLength={MAXIMO_CARACTERES}
            enterKeyHint="send"
            placeholder={sinPreguntas ? "Sin preguntas por hoy" : "Escribe tu pregunta"}
            disabled={sinPreguntas}
            aria-describedby="aviso-datos-personales"
            className="max-h-40 min-h-11 resize-none py-2.5"
          />
          <Button type="submit" size="icon-lg" aria-label="Enviar pregunta" disabled={!borrador.trim() || preguntar.isPending || sinPreguntas}>
            {preguntar.isPending ? <Spinner className="size-5" /> : <SendHorizontal className="size-5" aria-hidden="true" />}
          </Button>
        </div>
        {/* Spec "Privacidad de los datos enviados al modelo": lo que el estudiante escribe sí llega al modelo */}
        <p id="aviso-datos-personales" className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          No escribas datos personales, como tu número de documento o tu celular: tus preguntas se envían a un servicio de inteligencia
          artificial.
        </p>
        {restantes !== undefined && !sinPreguntas && (
          <p className="text-xs text-muted-foreground">
            {restantes === 1 ? "Te queda 1 pregunta hoy" : `Te quedan ${restantes} preguntas hoy`}
            {borrador.length > MAXIMO_CARACTERES - 100 && ` · ${borrador.length} de ${MAXIMO_CARACTERES} caracteres`} · {producto} puede
            equivocarse: revisa las fuentes.
          </p>
        )}
      </form>
      <div ref={fin} />

      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent
          onCloseAutoFocus={(evento) => {
            // El botón de borrar desaparece con la conversación: el foco va al campo de la pregunta
            evento.preventDefault();
            campo.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar tu conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran todos tus mensajes con {producto} y no se pueden recuperar. Las preguntas que hiciste hoy siguen contando para tu
              límite del día.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={borrarConversacion}>
              Borrar conversación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Bienvenida({
  nombrePila,
  producto,
  fundacion,
  deshabilitada,
  alElegir,
}: {
  nombrePila: string;
  producto: string;
  fundacion: string;
  deshabilitada: boolean;
  alElegir: (pregunta: string) => void;
}) {
  return (
    <section aria-labelledby="titulo-bienvenida" className="fondo-curvas overflow-hidden rounded-2xl border bg-card p-5 sm:p-8">
      <SimboloSenda className="size-11" />
      <h2 id="titulo-bienvenida" className="mt-4 text-2xl font-semibold tracking-tight">
        Hola, {nombrePila}. Soy {producto}.
      </h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Respondo con los documentos oficiales de {fundacion} y con tus propios datos: actividades pendientes, notas y estado de cuenta.
        Siempre te digo de dónde salió cada respuesta.
      </p>
      <p className="mt-6 text-sm font-medium">Puedes empezar con una de estas preguntas:</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {SUGERENCIAS.map(({ texto, Icono }) => (
          <li key={texto}>
            <button
              type="button"
              disabled={deshabilitada}
              onClick={() => alElegir(texto)}
              className="flex h-full min-h-11 w-full items-start gap-3 rounded-xl border border-input bg-background/80 px-4 py-3 text-left transition-colors outline-none hover:border-primary hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icono className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {texto}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MensajeEstudiante({ texto }: { texto: string }) {
  return (
    <div className={cn("flex justify-end", ENTRADA)}>
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]">
        <span className="sr-only">Tú: </span>
        {texto}
      </p>
    </div>
  );
}

function MensajeDelAsistente({ mensaje, producto }: { mensaje: MensajeAsistente; producto: string }) {
  return (
    <div className={cn("flex items-start gap-3", ENTRADA)}>
      <SimboloSenda className="mt-1 size-8" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-xs">
          <span className="sr-only">{producto}: </span>
          <TextoRespuesta contenido={mensaje.contenido} fuentes={mensaje.fuentes} />
        </div>
        {mensaje.fuentes.length > 0 && <ListaFuentes fuentes={mensaje.fuentes} />}
      </div>
    </div>
  );
}

// La respuesta del modelo como texto de React, nunca como HTML (web/src/lib/respuesta-asistente.ts)
function TextoRespuesta({ contenido, fuentes }: { contenido: string; fuentes: FuenteAsistente[] }) {
  return (
    <div className="space-y-2.5 leading-relaxed [overflow-wrap:anywhere]">
      {analizarRespuesta(contenido, fuentes).map((bloque, i) =>
        bloque.tipo === "parrafo" ? (
          <p key={i}>
            {bloque.lineas.map((linea, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Segmentos segmentos={linea} />
              </Fragment>
            ))}
          </p>
        ) : bloque.ordenada ? (
          <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
            {bloque.items.map((item, j) => (
              <li key={j}>
                <Segmentos segmentos={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-primary">
            {bloque.items.map((item, j) => (
              <li key={j}>
                <Segmentos segmentos={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Segmentos({ segmentos }: { segmentos: Segmento[] }) {
  return segmentos.map((segmento, i) => {
    if (segmento.tipo === "texto") return <Fragment key={i}>{segmento.texto}</Fragment>;
    if (segmento.tipo === "negrita") {
      return (
        <strong key={i} className="font-semibold">
          {segmento.texto}
        </strong>
      );
    }
    // El número de la fuente, como una nota al pie; la fuente completa está en la lista de abajo
    return (
      <span key={i} title={textoDeFuente(segmento.fuente)} className="relative -top-[0.4em] ml-0.5">
        <span
          aria-hidden="true"
          className="inline-grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-accent px-1 text-[0.7rem] leading-none font-semibold text-accent-foreground"
        >
          {segmento.numero}
        </span>
        <span className="sr-only"> (fuente {segmento.numero})</span>
      </span>
    );
  });
}

// Spec "Citas de las fuentes": el documento y la sección de cada fuente, junto a la respuesta
function ListaFuentes({ fuentes }: { fuentes: FuenteAsistente[] }) {
  return (
    <div className="space-y-1.5 pl-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Fuentes</p>
      <ol className="space-y-1.5">
        {fuentes.map((fuente, i) => (
          <li key={textoDeFuente(fuente)} className="flex items-start gap-2 text-sm">
            <span aria-hidden="true" className="mt-px inline-grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {i + 1}
            </span>
            <span>
              <span className="sr-only">Fuente {i + 1}: </span>
              <span className="font-medium">{fuente.documento}</span>
              <span className="text-muted-foreground"> · {fuente.seccion}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Mientras el agente consulta: tres pasos de la senda, el último en terracota como la meta del símbolo
function Buscando({ producto }: { producto: string }) {
  return (
    <div className="flex items-start gap-3" role="status">
      <SimboloSenda className="mt-1 size-8" />
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border bg-card px-4 py-3">
        <span aria-hidden="true" className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn("size-2 animate-pulse rounded-full motion-reduce:animate-none", i === 2 ? "bg-terracota" : "bg-primary")}
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </span>
        <span className="text-sm text-muted-foreground">{producto} está buscando la respuesta…</span>
      </div>
    </div>
  );
}

// Lo que pasó con la última pregunta: el límite del día (D9) o el servicio de IA no disponible (D11). El mensaje es
// el que envía la API ({ codigo, mensaje })
function AvisoDelEnvio({ error, sinPreguntas }: { error: Error | null; sinPreguntas: boolean }) {
  const porLimite = error instanceof ErrorApi && error.codigo === "LIMITE_DIARIO";
  if (sinPreguntas || porLimite) {
    return (
      <Alert className="border-info/30 bg-info-suave text-info">
        <CalendarClock aria-hidden="true" />
        <AlertDescription className="text-info">
          {porLimite ? error.message : "Ya hiciste todas tus preguntas de hoy. Podrás preguntar de nuevo mañana."}
        </AlertDescription>
      </Alert>
    );
  }
  if (!error) return null;
  return (
    <Alert variant="destructive" className="bg-peligro-suave">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}
