import type { CSSProperties, ReactNode } from "react";
import { BookOpen, CalendarClock, ChevronRight, CircleCheck, Lock, TriangleAlert, Upload } from "lucide-react";
import { ProgresoSenda } from "@/components/marca/ProgresoSenda";
import { Marca, SimboloSenda } from "@/components/marca/SimboloSenda";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Guía viva de la identidad visual (tarea 2.0, docs/identidad-visual.md). Solo existe en desarrollo:
// main.tsx la carga en /guia y el build de producción la descarta. Los datos de la composición de
// ejemplo son FICTICIOS y nunca llegan a producción; las pantallas reales leen todo de la API.

// Entrada escalonada al cargar (250 ms, docs/identidad-visual.md); se desactiva si la persona pidió menos movimiento
const entrada = "animate-in fade-in slide-in-from-bottom-2 duration-250 [animation-fill-mode:both] motion-reduce:animate-none";
const retraso = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

const PALETA = [
  { nombre: "Verde selva", token: "primary", hex: "#196144", uso: "Acciones principales y marca", contraste: "7,1:1", clase: "bg-primary" },
  { nombre: "Tinta", token: "foreground", hex: "#0D251B", uso: "Texto principal", contraste: "15,4:1", clase: "bg-foreground" },
  { nombre: "Papel", token: "background", hex: "#FCF9F3", uso: "Fondo de la aplicación", contraste: "—", clase: "bg-background" },
  { nombre: "Terracota", token: "terracota", hex: "#CD632D", uso: "La meta del símbolo y detalles", contraste: "3,7:1 (decorativo)", clase: "bg-terracota" },
  { nombre: "Salvia", token: "secondary", hex: "#DCF0DF", uso: "Acciones secundarias", contraste: "10,3:1", clase: "bg-secondary" },
  { nombre: "Musgo", token: "muted-foreground", hex: "#51625A", uso: "Texto de apoyo", contraste: "6,1:1", clase: "bg-muted-foreground" },
  { nombre: "Arcilla roja", token: "destructive", hex: "#B63325", uso: "Errores y bloqueo", contraste: "5,7:1", clase: "bg-destructive" },
  { nombre: "Azul río", token: "info", hex: "#1D5E85", uso: "Información y excepciones", contraste: "6,0:1", clase: "bg-info" },
];

const ESTADOS = [
  { variante: "exito", icono: CircleCheck, texto: "Al día", detalle: "Sin cuotas vencidas" },
  { variante: "alerta", icono: TriangleAlert, texto: "En riesgo", detalle: "Cuota vencida hace menos de 31 días" },
  { variante: "peligro", icono: Lock, texto: "Bloqueado", detalle: "Cuota vencida hace más de 30 días" },
  { variante: "info", icono: CalendarClock, texto: "Con excepción", detalle: "Acuerdo de pago vigente" },
] as const;

function Seccion({ titulo, descripcion, children, demora }: { titulo: string; descripcion: string; children: ReactNode; demora: number }) {
  return (
    <section className={`space-y-4 ${entrada}`} style={retraso(demora)}>
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{titulo}</h2>
        <p className="text-muted-foreground">{descripcion}</p>
      </header>
      {children}
    </section>
  );
}

// Composición de ejemplo: el inicio del estudiante en el celular, con datos ficticios
function InicioEstudianteEjemplo() {
  return (
    <div className="overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-background shadow-2xl shadow-primary/20">
      <div className="fondo-curvas space-y-5 px-4 pt-4 pb-6 [--opacidad-curvas:0.07]">
        <div className="flex items-center justify-between">
          <Marca nombre="Senda" className="text-lg" />
          <span
            aria-label="Perfil de Ana María"
            className="grid size-10 place-items-center rounded-full bg-secondary font-heading text-sm font-semibold text-secondary-foreground"
          >
            AM
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Semestre 2 · Gestión Cultural</p>
          <h3 className="text-3xl font-semibold tracking-tight">Hola, Ana María</h3>
        </div>

        <Card className="gap-3 py-4 text-base">
          <CardHeader className="px-4">
            <CardTitle className="text-lg font-semibold">Tu estado de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            <Badge variant="exito" className="h-7 gap-1.5 px-3 text-sm">
              <CircleCheck aria-hidden="true" />
              Al día
            </Badge>
            <p className="text-muted-foreground">Tu próxima cuota vence el 5 de diciembre.</p>
          </CardContent>
        </Card>

        <Card className="gap-4 py-4 text-base ring-primary/25">
          <CardHeader className="px-4">
            <CardDescription className="flex items-center gap-1.5 font-medium text-alerta">
              <CalendarClock aria-hidden="true" className="size-4" />
              Vence el lunes 23 de noviembre
            </CardDescription>
            <CardTitle className="text-xl font-semibold">Taller 3: Memoria oral del barrio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            <div className="space-y-2">
              <ProgresoSenda total={4} completados={2} etiqueta="2 de 4 actividades entregadas" />
              <p className="text-sm text-muted-foreground">2 de 4 actividades del curso entregadas</p>
            </div>
            <Button size="lg" className="w-full">
              <Upload data-icon="inline-start" aria-hidden="true" />
              Subir mi entrega
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h4 className="font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">Mis cursos</h4>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            {[
              ["Patrimonio y memoria", "Nota parcial 4,2"],
              ["Gestión de proyectos culturales", "Nota parcial 3,8"],
            ].map(([curso, nota]) => (
              <li key={curso} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <BookOpen aria-hidden="true" className="size-5 text-primary" />
                <span className="flex-1">
                  <span className="block leading-tight font-medium">{curso}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{nota}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function GuiaIdentidad() {
  return (
    <div className="min-h-svh">
      <header className="fondo-curvas border-b border-border [--opacidad-curvas:0.11]">
        <div className={`mx-auto max-w-6xl px-5 py-12 sm:py-16 ${entrada}`}>
          {/* La terracota pura es solo decorativa (3,7:1); como texto se usa su versión oscura */}
          <p className="mb-6 text-sm font-semibold tracking-widest text-accent-foreground uppercase">
            Guía de identidad visual · provisional
          </p>
          <Marca nombre="Senda" className="text-5xl sm:text-7xl" />
          <p className="mt-5 max-w-xl font-heading text-xl text-muted-foreground sm:text-2xl">
            Tu camino académico, paso a paso.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-10 lg:grid-cols-[380px_1fr] lg:gap-16">
        <aside className={`lg:sticky lg:top-8 lg:self-start ${entrada}`} style={retraso(60)}>
          <p className="mb-3 text-sm text-muted-foreground">Composición de ejemplo · datos ficticios</p>
          <InicioEstudianteEjemplo />
        </aside>

        <div className="space-y-14">
          <Seccion titulo="Paleta" descripcion="Colores de la tierra y de la selva. Todos los textos cumplen WCAG 2.2 AA." demora={100}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PALETA.map((c) => (
                <li key={c.token} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                  <div className={`h-16 ${c.clase} ${c.token === "background" ? "border-b border-border" : ""}`} />
                  <div className="space-y-0.5 p-3 text-sm">
                    <p className="font-semibold">{c.nombre}</p>
                    <p className="font-mono text-xs text-muted-foreground">{c.hex}</p>
                    <p className="text-muted-foreground">{c.uso}</p>
                    <p className="text-xs text-muted-foreground">Contraste: {c.contraste}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion titulo="Tipografía" descripcion="Fraunces para los títulos; Atkinson Hyperlegible Next para leer." demora={140}>
            <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <p className="font-heading text-5xl font-semibold tracking-tight">Aprender es un camino</p>
              <p className="font-heading text-2xl">Títulos en Fraunces, con tamaño óptico</p>
              <p className="max-w-prose text-base leading-relaxed">
                El texto usa Atkinson Hyperlegible Next, diseñada por el Braille Institute para personas con baja visión. Distingue
                los caracteres que se confunden con facilidad:
              </p>
              <p className="text-2xl tracking-wide tabular-nums">Il1 O0 · CC 1000123456 · $ 250.000</p>
            </div>
          </Seccion>

          <Seccion titulo="Componentes" descripcion="Botones y campos de 44 px para el celular; foco siempre visible." demora={180}>
            <div className="space-y-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex flex-wrap gap-3">
                <Button size="lg">Ingresar</Button>
                <Button size="lg" variant="secondary">
                  Ver mis notas
                </Button>
                <Button size="lg" variant="outline">
                  Cancelar
                </Button>
                <Button size="lg" variant="destructive">
                  Anular pago
                </Button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guia-documento">Número de documento</Label>
                  <Input id="guia-documento" inputMode="numeric" placeholder="Sin puntos ni espacios" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guia-contrasena">Contraseña</Label>
                  <Input id="guia-contrasena" type="password" defaultValue="corta" aria-invalid="true" aria-describedby="guia-error" />
                  <p id="guia-error" className="text-sm text-destructive">
                    La contraseña nueva debe tener al menos 8 caracteres
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold">Estados de cartera: siempre ícono y texto, nunca solo color</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ESTADOS.map(({ variante, icono: Icono, texto, detalle }) => (
                    <li key={variante} className="flex items-center gap-3">
                      <Badge variant={variante} className="h-7 gap-1.5 px-3 text-sm">
                        <Icono aria-hidden="true" />
                        {texto}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{detalle}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Alert variant="destructive" className="bg-peligro-suave px-4 py-3 text-base">
                <Lock aria-hidden="true" />
                <AlertTitle>Tu acceso está suspendido</AlertTitle>
                <AlertDescription>Tienes una cuota con más de 30 días de vencida. Comunícate con la Fundación.</AlertDescription>
              </Alert>
            </div>
          </Seccion>

          <Seccion titulo="Símbolo" descripcion="Un sendero que sube por la ladera; cada punto es un paso y la meta es terracota." demora={220}>
            <div className="flex flex-wrap items-end gap-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <SimboloSenda className="size-24" titulo="Símbolo de Senda" />
              <SimboloSenda className="size-12" />
              <SimboloSenda className="size-8" />
              <SimboloSenda className="size-4" />
              <div className="fondo-curvas rounded-xl bg-primary px-6 py-5 [--opacidad-curvas:0.16] [--tinta-curvas:var(--primary-foreground)]">
                <Marca nombre="Senda" className="text-3xl text-primary-foreground" />
              </div>
            </div>
          </Seccion>
        </div>
      </main>
    </div>
  );
}
