import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod";

// Forma única de los errores de la API: un código estable que el frontend puede evaluar
// y un mensaje en español listo para mostrarle a la persona
export type ErrorApi = { codigo: string; mensaje: string };

export const responderError = (c: Context, estado: ContentfulStatusCode, codigo: string, mensaje: string) =>
  c.json<ErrorApi>({ codigo, mensaje }, estado);

// Valida el cuerpo JSON con un esquema de zod (design.md D2). Si no cumple, responde 400 SOLICITUD_INVALIDA
// sin ejecutar la ruta. Un cuerpo que no es JSON llega vacío y tampoco cumple el esquema.
export const validarJson = <T extends ZodType>(esquema: T, mensaje: string) =>
  zValidator("json", esquema, (resultado, c) => {
    if (!resultado.success) return responderError(c, 400, "SOLICITUD_INVALIDA", mensaje);
  });
