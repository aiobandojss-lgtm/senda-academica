import { cn } from "@/lib/utils";

// Avance en forma de senda (docs/identidad-visual.md): un punto por paso unido por una línea punteada,
// verde selva si está hecho y la meta en terracota. Lleva el texto para lectores de pantalla:
// el avance nunca se comunica solo con color.
export function ProgresoSenda({
  total,
  completados,
  etiqueta,
  className,
}: {
  total: number;
  completados: number;
  // Lo que lee el lector de pantalla, por ejemplo "2 de 4 actividades entregadas"
  etiqueta: string;
  className?: string;
}) {
  const pasos = Array.from({ length: total }, (_, i) => i < completados);

  return (
    <div role="img" aria-label={etiqueta} className={cn("flex items-center", className)}>
      {pasos.map((hecho, i) => {
        const esMeta = i === total - 1;
        return (
          <span key={i} className="flex flex-1 items-center last:flex-none">
            <span
              aria-hidden="true"
              className={cn(
                "size-3 shrink-0 rounded-full border-2",
                hecho ? "border-primary bg-primary" : "border-input bg-card",
                esMeta && (hecho ? "border-terracota bg-terracota" : "border-terracota"),
              )}
            />
            {!esMeta && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-1 h-0 flex-1 border-t-2 border-dotted",
                  i < completados - 1 ? "border-primary" : "border-input",
                )}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
