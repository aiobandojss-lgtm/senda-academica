import { Hono } from "hono";
import { z } from "zod";
import { idDeRuta, responderError, validarJson } from "../errores";
import { accesoDenegado } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { textoOpcional } from "../validacion";
import { aEntrega } from "./actividades";

// Calificación (spec "Calificación"): solo el docente del curso pone o corrige la nota. El administrador
// ve y descarga todo, pero no califica: ninguna nota aparece sin que la ponga el profesor.
export const calificaciones = new Hono<AppEnv>();

const MENSAJE_NOTA = "La nota va de 0.0 a 5.0, con un decimal";
// Un decimal: 4.2 sí, 4.25 no. Se compara con tolerancia porque 4.2 * 10 no es exactamente 42 en binario.
const nota = z
  .number({ error: MENSAJE_NOTA })
  .refine((n) => n >= 0 && n <= 5 && Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, MENSAJE_NOTA)
  .transform((n) => Math.round(n * 10) / 10);
const esquema = z.object({ nota, comentario: textoOpcional(1000, "El comentario").optional() });

calificaciones.put(
  "/:id/calificacion",
  // La nota fuera de rango tiene su propio código, para que la interfaz lo distinga
  validarJson(esquema, { codigoPorCampo: { nota: "NOTA_FUERA_DE_RANGO" } }),
  async (c) => {
    const id = idDeRuta(c);
    const entrega = id
      ? await c.env.DB.prepare(
          `SELECT e.id, k.docente_id
             FROM entregas e JOIN actividades a ON a.id = e.actividad_id JOIN cursos k ON k.id = a.curso_id
            WHERE e.id = ?`,
        )
          .bind(id)
          .first<{ id: number; docente_id: number | null }>()
      : null;
    if (!entrega) return responderError(c, 404, "ENTREGA_NO_ENCONTRADA", "La entrega no existe");
    const usuario = c.var.usuario;
    if (usuario.rol !== "docente" || entrega.docente_id !== usuario.id) return accesoDenegado(c);

    const datos = c.req.valid("json");
    await c.env.DB.prepare(
      `UPDATE entregas SET nota = ?, comentario = ?, calificado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), calificado_por = ?
        WHERE id = ?`,
    )
      .bind(datos.nota, datos.comentario ?? null, usuario.id, entrega.id)
      .run();

    const fila = await c.env.DB.prepare(
      `SELECT e.id AS entrega_id, e.entregado_en, e.nota, e.comentario, e.nombre_archivo, a.fecha_limite
         FROM entregas e JOIN actividades a ON a.id = e.actividad_id WHERE e.id = ?`,
    )
      .bind(entrega.id)
      .first<Parameters<typeof aEntrega>[0]>();
    return c.json(aEntrega(fila!));
  },
);
