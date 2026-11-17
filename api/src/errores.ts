import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type ZodType, z } from "zod";

// Respaldo: si a un campo le falta su mensaje propio, zod responde en español y no en inglés
z.config(z.locales.es());

// Forma única de los errores de la API: un código estable que el frontend puede evaluar
// y un mensaje en español listo para mostrarle a la persona. En errores de validación,
// `campo` dice qué dato está mal, para mostrar el mensaje junto a ese campo del formulario.
export type ErrorApi = { codigo: string; mensaje: string; campo?: string };

export const responderError = (c: Context, estado: ContentfulStatusCode, codigo: string, mensaje: string) =>
  c.json<ErrorApi>({ codigo, mensaje }, estado);

// Valida el cuerpo JSON con un esquema de zod (design.md D2). Si no cumple, responde 400 SOLICITUD_INVALIDA
// sin ejecutar la ruta. Un cuerpo que no es JSON llega vacío y tampoco cumple el esquema.
// - Con `mensaje` fijo (rutas de autenticación) no se dice qué campo falló.
// - Sin él, se usa el mensaje del primer error, que los esquemas escriben en español campo por campo.
// - `codigoPorCampo` da a un campo su propio código (p. ej. la nota: NOTA_FUERA_DE_RANGO).
export const validarJson = <T extends ZodType>(esquema: T, opcion?: string | { codigoPorCampo: Record<string, string> }) =>
  zValidator("json", esquema, (resultado, c) => {
    if (resultado.success) return;
    const problema = resultado.error.issues[0];
    const mensaje = typeof opcion === "string" ? opcion : undefined;
    if (mensaje || !problema) return responderError(c, 400, "SOLICITUD_INVALIDA", mensaje ?? "La solicitud no es válida");
    const campo = problema.path.join(".");
    const codigo = (typeof opcion === "object" && opcion.codigoPorCampo[campo]) || "SOLICITUD_INVALIDA";
    return c.json<ErrorApi>({ codigo, mensaje: problema.message, ...(campo ? { campo } : {}) }, 400);
  });

// Violación de una restricción UNIQUE de D1 sobre `tabla.columna` (p. ej. "usuarios.documento").
// Se detecta al insertar, y no con una consulta previa, para no dejar una ventana entre consultar y guardar.
export const esUnicoRepetido = (error: unknown, columna: string) =>
  error instanceof Error && error.message.includes(`UNIQUE constraint failed: ${columna}`);

// Id numérico de la ruta (/recurso/:id); null si no es un entero positivo
export function idDeRuta(c: Context): number | null {
  const id = Number(c.req.param("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Código de un trigger de D13 (RAISE(ABORT, 'CODIGO')) dentro del error de D1, o null. La API lo traduce a un
// mensaje en español: es el mismo principio que RAISE_APPLICATION_ERROR en Oracle.
const CODIGOS_DE_TRIGGER = ["PAGO_SUPERA_SALDO", "PAGO_INMUTABLE", "CUOTA_CON_PAGOS", "ENTREGA_CALIFICADA"] as const;
export function codigoDeTrigger(error: unknown): (typeof CODIGOS_DE_TRIGGER)[number] | null {
  if (!(error instanceof Error)) return null;
  return CODIGOS_DE_TRIGGER.find((codigo) => error.message.includes(codigo)) ?? null;
}

// Pesos colombianos para los mensajes: 80000 → "$ 80.000" (dinero en enteros, D9)
export const pesos = (valor: number) => `$ ${String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
