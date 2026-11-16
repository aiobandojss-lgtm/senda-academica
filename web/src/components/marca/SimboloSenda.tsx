import { cn } from "@/lib/utils";

// Símbolo de Senda (docs/identidad-visual.md): un sendero punteado que sube en zigzag por una ladera
// hasta la meta, en terracota. Cada punto es un paso. Es decorativo salvo que reciba un título.
export function SimboloSenda({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M8.5 25.5C15 25.5 22.5 24.6 22.5 20.8S9.5 17.4 9.5 13.3 15 9 19.4 8.8"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="0.01 4.1"
      />
      <circle cx="22.8" cy="8.6" r="2.6" fill="var(--terracota)" />
    </svg>
  );
}

// Símbolo y nombre del producto. El nombre llega de la configuración (PRODUCTO_NOMBRE, D19), nunca fijo
export function Marca({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SimboloSenda className="size-[1.6em]" />
      <span className="font-heading font-semibold tracking-tight">{nombre}</span>
    </span>
  );
}
