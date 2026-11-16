import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { SimboloSenda } from "./SimboloSenda";

// Pantallas previas a la configuración: todavía no se conoce el nombre del producto (D19), así que solo
// muestran el símbolo, nunca un nombre escrito en el código.

export function PantallaCarga() {
  return (
    <main className="fondo-curvas grid min-h-svh place-items-center p-5">
      <div className="flex flex-col items-center gap-5">
        <SimboloSenda className="size-14" />
        <Spinner className="size-5 text-primary" />
      </div>
    </main>
  );
}

export function PantallaSinConexion({ alReintentar }: { alReintentar: () => void }) {
  return (
    <main className="fondo-curvas grid min-h-svh place-items-center p-5">
      <section className="flex max-w-sm flex-col items-center gap-4 text-center">
        <SimboloSenda className="size-14" />
        <h1 className="text-2xl font-semibold tracking-tight">No pudimos conectar con la plataforma</h1>
        <p className="text-muted-foreground">Revisa tu conexión a internet e intenta de nuevo.</p>
        <Button size="lg" onClick={alReintentar}>
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          Intentar de nuevo
        </Button>
      </section>
    </main>
  );
}
