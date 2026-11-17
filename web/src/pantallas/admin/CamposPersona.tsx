import { Campo } from "@/components/formularios/Campo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoDocumento } from "@/lib/consultas";
import { TIPOS_DOCUMENTO } from "@/lib/textos";
import type { DatosPersona } from "./persona";

// Campos de los datos personales de docentes y estudiantes

export function CamposPersona({
  datos,
  alCambiar,
  errores,
}: {
  datos: DatosPersona;
  alCambiar: (cambio: Partial<DatosPersona>) => void;
  errores: Record<string, string>;
}) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Campo id="tipoDocumento" etiqueta="Tipo de documento" error={errores.tipoDocumento}>
          {(control) => (
            <Select value={datos.tipoDocumento} onValueChange={(valor) => alCambiar({ tipoDocumento: valor as TipoDocumento })}>
              <SelectTrigger {...control} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.texto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
        <Campo
          id="documento"
          etiqueta="Número de documento"
          descripcion="Es su usuario para ingresar"
          error={errores.documento}
        >
          {(control) => (
            <Input
              {...control}
              value={datos.documento}
              onChange={(e) => alCambiar({ documento: e.target.value })}
              autoComplete="off"
              spellCheck={false}
              placeholder="Sin puntos ni espacios"
              required
            />
          )}
        </Campo>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="nombres" etiqueta="Nombres" error={errores.nombres}>
          {(control) => <Input {...control} value={datos.nombres} onChange={(e) => alCambiar({ nombres: e.target.value })} required />}
        </Campo>
        <Campo id="apellidos" etiqueta="Apellidos" error={errores.apellidos}>
          {(control) => <Input {...control} value={datos.apellidos} onChange={(e) => alCambiar({ apellidos: e.target.value })} required />}
        </Campo>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Campo id="correo" etiqueta="Correo" error={errores.correo}>
          {(control) => (
            <Input {...control} type="email" value={datos.correo} onChange={(e) => alCambiar({ correo: e.target.value })} required />
          )}
        </Campo>
        <Campo id="celular" etiqueta="Celular (opcional)" error={errores.celular}>
          {(control) => (
            <Input {...control} type="tel" inputMode="tel" value={datos.celular} onChange={(e) => alCambiar({ celular: e.target.value })} />
          )}
        </Campo>
      </div>
    </>
  );
}
