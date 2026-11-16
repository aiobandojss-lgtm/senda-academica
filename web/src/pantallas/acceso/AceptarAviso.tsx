import { CircleAlert, FileWarning } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TextoAvisoPrivacidad } from "@/contenido/TextoAvisoPrivacidad";
import { api, type Perfil } from "@/lib/api";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";
import { MarcoAcceso } from "./MarcoAcceso";

// Aceptación del aviso de privacidad (spec `autenticacion`, Ley 1581 de 2012). La API guarda la versión
// vigente y la fecha; "No acepto" cierra la sesión, porque sin aceptarlo no se puede usar la plataforma.
export default function AceptarAviso() {
  useTituloPagina("Aviso de privacidad");
  const { config, actualizarPerfil, salir } = useSesion();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setError(null);
    setEnviando(true);
    try {
      actualizarPerfil(await api.post<Perfil>("/auth/aviso"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado");
      setEnviando(false);
    }
  }

  const noAcepto = () =>
    void salir(
      `Para usar ${config.productoNombre} necesitas aceptar el aviso de privacidad. Si tienes dudas, comunícate con ${config.contactoFundacion}.`,
    );

  return (
    <MarcoAcceso ancho="max-w-2xl">
      <article className={`space-y-8 ${ENTRADA}`}>
        <header className="space-y-3">
          <p className="text-sm font-medium tracking-wide text-accent-foreground uppercase">Antes de continuar</p>
          <h1 className="text-3xl font-semibold tracking-tight">Aviso de privacidad</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="alerta">
              <FileWarning aria-hidden="true" />
              Borrador
            </Badge>
            <span>Versión {config.avisoPrivacidadVersion} · pendiente de aprobación de la Fundación</span>
          </div>
        </header>

        <TextoAvisoPrivacidad config={config} />

        {error && (
          <Alert variant="destructive" className="bg-peligro-suave">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <Button variant="outline" size="lg" onClick={noAcepto} disabled={enviando}>
            No acepto
          </Button>
          <Button size="lg" onClick={() => void aceptar()} disabled={enviando}>
            {enviando && <Spinner data-icon="inline-start" aria-hidden="true" />}
            Acepto el aviso de privacidad
          </Button>
        </div>
      </article>
    </MarcoAcceso>
  );
}
