import { Check, Copy, EllipsisVertical, KeyRound, Pencil, UserCheck, UserX } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useCambioCatalogo } from "@/lib/consultas";

export type PersonaBasica = { id: number; nombres: string; apellidos: string; documento: string; activo: boolean };

// Contraseña temporal (D17): se muestra una sola vez. Es un AlertDialog para que no se cierre con un clic
// afuera por accidente: el administrador confirma que ya la tiene.
export function DialogoContrasena({
  persona,
  contrasena,
  alCerrar,
}: {
  persona: Pick<PersonaBasica, "nombres" | "documento">;
  contrasena: string | null;
  alCerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(contrasena ?? "");
      setCopiada(true);
    } catch {
      toast.error("No se pudo copiar. Selecciónala y cópiala a mano.");
    }
  };

  return (
    <AlertDialog open={contrasena !== null} onOpenChange={(abierto) => !abierto && alCerrar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Contraseña temporal de {persona.nombres}</AlertDialogTitle>
          <AlertDialogDescription>
            Se muestra solo esta vez. Entrégasela a la persona: ingresa con su documento {persona.documento} y debe cambiarla al
            entrar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card p-3">
          <output className="flex-1 font-sans text-2xl font-semibold tracking-[0.12em] tabular-nums select-all" aria-label="Contraseña temporal">
            {contrasena}
          </output>
          <Button variant="outline" onClick={() => void copiar()}>
            {copiada ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
            {copiada ? "Copiada" : "Copiar"}
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={alCerrar}>Ya la tengo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Confirmación de una acción delicada. El botón dice la acción con un verbo, nunca "Aceptar" a secas.
export function Confirmar({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  accion,
  peligro = false,
  pendiente,
  alConfirmar,
}: {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  accion: string;
  peligro?: boolean;
  pendiente: boolean;
  alConfirmar: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={alCambiar}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={peligro ? "destructive" : "default"}
            disabled={pendiente}
            // Se cierra cuando la API responde, no antes
            onClick={(evento) => {
              evento.preventDefault();
              alConfirmar();
            }}
          >
            {pendiente && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {accion}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Tipo = "docente" | "estudiante";
const AL_DESACTIVAR: Record<Tipo, string> = {
  docente: "No podrá ingresar y se cerrarán sus sesiones abiertas. Sus cursos lo conservan como docente hasta que asignes otro.",
  estudiante: "No podrá ingresar y se cerrarán sus sesiones abiertas. Su información, sus entregas, sus notas y sus pagos se conservan.",
};

// Acciones sobre la cuenta de un docente o un estudiante (spec `carreras-estudiantes` y `autenticacion`)
export function MenuCuenta({ persona, tipo, alEditar }: { persona: PersonaBasica; tipo: Tipo; alEditar: () => void }) {
  const [confirmando, setConfirmando] = useState<"restablecer" | "estado" | null>(null);
  const [contrasena, setContrasena] = useState<string | null>(null);
  const nombre = `${persona.nombres} ${persona.apellidos}`;

  const restablecer = useCambioCatalogo(() => api.post<{ contrasenaTemporal: string }>(`/usuarios/${persona.id}/restablecer-contrasena`));
  const cambiarEstado = useCambioCatalogo(() => api.post(`/usuarios/${persona.id}/${persona.activo ? "desactivar" : "reactivar"}`));

  const confirmarRestablecer = () =>
    restablecer.mutate(undefined, {
      onSuccess: ({ contrasenaTemporal }) => {
        setConfirmando(null);
        setContrasena(contrasenaTemporal);
      },
      onError: (error) => toast.error(error.message),
    });
  const confirmarEstado = () =>
    cambiarEstado.mutate(undefined, {
      onSuccess: () => {
        setConfirmando(null);
        // Neutro: se habla de la cuenta, no de la persona
        toast.success(persona.activo ? `La cuenta de ${nombre} quedó desactivada` : `La cuenta de ${nombre} quedó activa de nuevo`);
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones de ${nombre}`}>
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={alEditar}>
            <Pencil aria-hidden="true" />
            Editar datos
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmando("restablecer")} disabled={!persona.activo}>
            <KeyRound aria-hidden="true" />
            Restablecer contraseña
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant={persona.activo ? "destructive" : "default"} onSelect={() => setConfirmando("estado")}>
            {persona.activo ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
            {persona.activo ? "Desactivar" : "Reactivar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Confirmar
        abierto={confirmando === "restablecer"}
        alCambiar={(abierto) => !abierto && setConfirmando(null)}
        titulo={`¿Restablecer la contraseña de ${nombre}?`}
        descripcion="Se genera una contraseña temporal nueva y se cierran sus sesiones abiertas. Si estaba bloqueado por intentos fallidos, podrá ingresar de inmediato."
        accion="Restablecer contraseña"
        pendiente={restablecer.isPending}
        alConfirmar={confirmarRestablecer}
      />
      <Confirmar
        abierto={confirmando === "estado"}
        alCambiar={(abierto) => !abierto && setConfirmando(null)}
        titulo={persona.activo ? `¿Desactivar a ${nombre}?` : `¿Reactivar a ${nombre}?`}
        descripcion={persona.activo ? AL_DESACTIVAR[tipo] : "Podrá volver a ingresar con su contraseña de siempre."}
        accion={persona.activo ? "Desactivar" : "Reactivar"}
        peligro={persona.activo}
        pendiente={cambiarEstado.isPending}
        alConfirmar={confirmarEstado}
      />
      <DialogoContrasena persona={persona} contrasena={contrasena} alCerrar={() => setContrasena(null)} />
    </>
  );
}
