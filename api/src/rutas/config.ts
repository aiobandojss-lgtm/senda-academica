import { Hono } from "hono";
import type { AppEnv } from "../tipos";

// Configuración pública (design.md D19). Es pública porque la pantalla de ingreso la necesita antes de
// que haya sesión. Lista explícita: nunca se devuelve el env completo, así ni ALMACEN_ARCHIVOS ni un
// secreto o variable nueva se pueden filtrar por accidente.
export const config = new Hono<AppEnv>();

config.get("/publica", (c) =>
  c.json({
    productoNombre: c.env.PRODUCTO_NOMBRE,
    fundacionNombre: c.env.FUNDACION_NOMBRE,
    contactoFundacion: c.env.CONTACTO_FUNDACION,
    avisoPrivacidadVersion: c.env.AVISO_PRIVACIDAD_VERSION,
  }),
);
