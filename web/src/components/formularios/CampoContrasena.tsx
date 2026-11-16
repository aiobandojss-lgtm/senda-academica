import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  // "current-password" para la actual; "new-password" para que el navegador ofrezca guardarla
  autoComplete: "current-password" | "new-password";
  descripcion?: string;
  error?: string | null;
};

// Campo de contraseña con botón para mostrarla: en el celular es fácil equivocarse al escribir una
// contraseña temporal, y la tipografía Atkinson distingue los caracteres que se confunden (I l 1, O 0).
export function CampoContrasena({ id, etiqueta, valor, alCambiar, autoComplete, descripcion, error }: Props) {
  const [visible, setVisible] = useState(false);
  const idDescripcion = descripcion ? `${id}-descripcion` : undefined;
  const idError = error ? `${id}-error` : undefined;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={128}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[idDescripcion, idError].filter(Boolean).join(" ") || undefined}
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
          // Botón de alternancia: etiqueta fija y aria-pressed dice si está activo
          aria-label="Mostrar contraseña"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {descripcion && <FieldDescription id={idDescripcion}>{descripcion}</FieldDescription>}
      {error && <FieldError id={idError}>{error}</FieldError>}
    </Field>
  );
}
