import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type EstadoApi = "verificando" | "en_linea" | "sin_conexion";

const TEXTO_ESTADO: Record<EstadoApi, string> = {
  verificando: "Verificando la conexión con la API…",
  en_linea: "API en línea",
  sin_conexion: "No hay conexión con la API",
};

// Consulta GET /api/salud; devuelve true solo si la API responde {"ok": true}
async function consultarSalud(senal: AbortSignal): Promise<boolean> {
  const respuesta = await fetch("/api/salud", { signal: senal });
  if (!respuesta.ok) return false;
  const datos = (await respuesta.json()) as { ok?: unknown };
  return datos.ok === true;
}

// Página inicial provisional: la identidad visual de Senda llega en la tarea 2.0
export default function App() {
  const [estadoApi, setEstadoApi] = useState<EstadoApi>("verificando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    consultarSalud(controlador.signal)
      .then((ok) => setEstadoApi(ok ? "en_linea" : "sin_conexion"))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEstadoApi("sin_conexion");
      });
    return () => controlador.abort();
  }, [intento]);

  const verificarDeNuevo = useCallback(() => {
    setEstadoApi("verificando");
    setIntento((n) => n + 1);
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <section className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        <header className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Plataforma académica</h1>
          <p className="text-sm text-muted-foreground">En construcción.</p>
        </header>

        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={
              estadoApi === "en_linea"
                ? "size-2.5 rounded-full bg-emerald-600"
                : estadoApi === "sin_conexion"
                  ? "size-2.5 rounded-full bg-destructive"
                  : "size-2.5 animate-pulse rounded-full bg-muted-foreground"
            }
          />
          {TEXTO_ESTADO[estadoApi]}
        </p>

        <Button variant="outline" onClick={verificarDeNuevo} disabled={estadoApi === "verificando"}>
          Verificar de nuevo
        </Button>
      </section>
    </main>
  );
}
