import { CircleAlert, Info } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CampoContrasena } from "@/components/formularios/CampoContrasena";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ErrorApi } from "@/lib/api";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";
import { MarcoAcceso } from "./MarcoAcceso";

// Spec `autenticacion`: documento y contraseña. El mensaje de error es el que envía la API, el mismo
// exista o no el documento. Al ingresar, la puerta de esta ruta lleva a la persona a su destino.
export default function Ingresar() {
  useTituloPagina("Ingresar");
  const { ingresar, avisoIngreso, config } = useSesion();
  const [documento, setDocumento] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await ingresar(documento, contrasena);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado. Intenta de nuevo en unos minutos");
      setContrasena("");
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso>
      <div className={`space-y-8 ${ENTRADA}`}>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Ingresa a tu cuenta</h1>
          <p className="text-muted-foreground">Usa tu número de documento y tu contraseña.</p>
        </header>

        {avisoIngreso && !error && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription className="text-foreground">{avisoIngreso}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={alEnviar} className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="documento">Número de documento</FieldLabel>
              {/* Teclado de texto y no numérico: un pasaporte puede tener letras y el teclado numérico
                  del celular no deja escribirlas */}
              <Input
                id="documento"
                name="documento"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                maxLength={20}
                placeholder="Sin puntos ni espacios"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
              />
            </Field>
            <CampoContrasena
              id="contrasena"
              etiqueta="Contraseña"
              autoComplete="current-password"
              valor={contrasena}
              alCambiar={setContrasena}
            />
          </FieldGroup>

          {error && (
            <Alert variant="destructive" className="bg-peligro-suave">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            {enviando && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {enviando ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          ¿Olvidaste tu contraseña? Comunícate con {config.contactoFundacion} para restablecerla.
        </p>
      </div>
    </MarcoAcceso>
  );
}
