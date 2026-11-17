import type { ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

// Atributos de accesibilidad que el control recibe del campo: así el lector de pantalla anuncia la
// etiqueta, la ayuda y el error del campo que tiene el foco
export type PropsControl = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

type Props = {
  id: string;
  etiqueta: string;
  descripcion?: string;
  error?: string;
  children: (control: PropsControl) => ReactNode;
};

// Campo de formulario de la administración: etiqueta, control, ayuda y error, enlazados (docs/identidad-visual.md)
export function Campo({ id, etiqueta, descripcion, error, children }: Props) {
  const idDescripcion = descripcion ? `${id}-descripcion` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idDescripcion, idError].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {descripcion && <FieldDescription id={idDescripcion}>{descripcion}</FieldDescription>}
      {error && <FieldError id={idError}>{error}</FieldError>}
    </Field>
  );
}
