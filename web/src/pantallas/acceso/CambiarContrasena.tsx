import { CircleAlert, CircleCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { CampoContrasena } from "@/components/formularios/CampoContrasena";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api, ErrorApi, type Perfil } from "@/lib/api";
import { ENTRADA } from "@/lib/movimiento";
import { useSesion, useTituloPagina } from "@/sesion/useSesion";
import { MarcoAcceso } from "./MarcoAcceso";

type Errores = { actual?: string; nueva?: string; confirmacion?: string; general?: string };

// Cada código de la API (spec `autenticacion`, tarea 2.5) se muestra junto al campo que lo causó
const CAMPO_DEL_CODIGO: Record<string, keyof Errores> = {
  CONTRASENA_ACTUAL_INCORRECTA: "actual",
  CONTRASENA_CORTA: "nueva",
  CONTRASENA_IGUAL_DOCUMENTO: "nueva",
  CONTRASENA_IGUAL_ACTUAL: "nueva",
};

// Cambio de contraseña (D16). Obligatorio: primer ingreso o restablecimiento, fuera del menú; al
// terminar, la puerta lleva a la siguiente compuerta o al inicio. Voluntario: dentro del layout del rol.
export default function CambiarContrasena({ obligatorio = false }: { obligatorio?: boolean }) {
  useTituloPagina(obligatorio ? "Crea tu contraseña" : "Cambiar contraseña");
  const { actualizarPerfil, salir } = useSesion();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [cambiada, setCambiada] = useState(false);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCambiada(false);
    // La confirmación solo existe en el navegador: evita guardar una contraseña mal escrita
    if (nueva !== confirmacion) {
      setErrores({ confirmacion: "Las contraseñas no coinciden" });
      return;
    }
    setErrores({});
    setEnviando(true);
    try {
      const perfil = await api.post<Perfil>("/auth/contrasena", { actual, nueva });
      setActual("");
      setNueva("");
      setConfirmacion("");
      setCambiada(!obligatorio);
      actualizarPerfil(perfil);
    } catch (e) {
      if (e instanceof ErrorApi && CAMPO_DEL_CODIGO[e.codigo]) setErrores({ [CAMPO_DEL_CODIGO[e.codigo]]: e.message });
      else setErrores({ general: e instanceof Error ? e.message : "Ocurrió un error inesperado" });
    } finally {
      setEnviando(false);
    }
  }

  const formulario = (
    <form onSubmit={alEnviar} className="space-y-6">
      <FieldGroup>
        <CampoContrasena
          id="actual"
          etiqueta={obligatorio ? "Contraseña temporal" : "Contraseña actual"}
          autoComplete="current-password"
          valor={actual}
          alCambiar={setActual}
          error={errores.actual}
        />
        <CampoContrasena
          id="nueva"
          etiqueta="Contraseña nueva"
          autoComplete="new-password"
          descripcion={`Mínimo 8 caracteres. No puede ser tu número de documento ni la contraseña ${obligatorio ? "temporal" : "actual"}.`}
          valor={nueva}
          alCambiar={setNueva}
          error={errores.nueva}
        />
        <CampoContrasena
          id="confirmacion"
          etiqueta="Confirma la contraseña nueva"
          autoComplete="new-password"
          valor={confirmacion}
          alCambiar={setConfirmacion}
          error={errores.confirmacion}
        />
      </FieldGroup>

      {errores.general && (
        <Alert variant="destructive" className="bg-peligro-suave">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{errores.general}</AlertDescription>
        </Alert>
      )}
      {cambiada && (
        <Alert className="border-exito/30 bg-exito-suave text-exito" role="status">
          <CircleCheck aria-hidden="true" />
          <AlertDescription className="text-exito">
            Tu contraseña se cambió. Si tenías la sesión abierta en otro equipo, allí se cerró.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" aria-hidden="true" />}
        {enviando ? "Guardando…" : "Guardar mi contraseña"}
      </Button>
    </form>
  );

  if (!obligatorio) {
    return (
      <section className={`max-w-md space-y-6 ${ENTRADA}`}>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Cambiar contraseña</h1>
          <p className="text-muted-foreground">Por seguridad, primero escribe tu contraseña actual.</p>
        </header>
        {formulario}
      </section>
    );
  }

  return (
    <MarcoAcceso>
      <div className={`space-y-8 ${ENTRADA}`}>
        <header className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-accent-foreground uppercase">Antes de continuar</p>
          <h1 className="text-3xl font-semibold tracking-tight">Crea tu contraseña</h1>
          <p className="text-muted-foreground">
            Cambia la contraseña temporal que te entregaron por una que solo tú conozcas.
          </p>
        </header>
        {formulario}
        <Button variant="ghost" className="-ml-3" onClick={() => void salir()}>
          Salir
        </Button>
      </div>
    </MarcoAcceso>
  );
}
