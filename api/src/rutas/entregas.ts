import { type Context, Hono } from "hono";
import { almacenDe } from "../archivos/almacen";
import { type Formato, formatoDe, MENSAJE_FORMATOS, TAMANO_MAXIMO } from "../archivos/formatos";
import { idDeRuta, responderError } from "../errores";
import { accesoDenegado } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { actividadVisible, esDocenteDelCurso } from "./acceso";
import { aEntrega, vistaDocente } from "./actividades";

// Archivos de una actividad (spec `actividades-entregas`, design.md D7): la entrega de cada estudiante y el
// archivo de apoyo que adjunta el docente. Cada subida usa una llave nueva (nunca se sobrescribe): primero
// se guarda el archivo, después se actualiza la fila y al final se borra el anterior. Si el borrado
// fallara, quedaría un objeto huérfano, nunca una entrega sin archivo.
export const archivosDeActividad = new Hono<AppEnv>();

// Las entregas del seed comparten una sola llave (seed/placeholder.pdf). Borrarla al reemplazar una de
// ellas dejaría sin archivo a todas las demás: las llaves del seed nunca se borran.
const esCompartida = (llave: string) => llave.startsWith("seed/");

// Nombre que mostrará la plataforma: sin rutas de carpetas ni caracteres de control, con un largo razonable
function nombreSeguro(nombre: string, formato: Formato) {
  const base = (nombre.split(/[\\/]/).pop() ?? "")
    .replace(/[\p{Cc}]/gu, "")
    .trim()
    .slice(0, 150);
  return base || `archivo.${formato.extension}`;
}

// Lee y valida el archivo del formulario (campo "archivo"): presente, de hasta 10 MB y en un formato
// permitido según su contenido (spec "Entrega de archivos")
async function archivoDeLaPeticion(c: Context<AppEnv>): Promise<{ datos: ArrayBuffer; nombre: string; formato: Formato } | Response> {
  const muyGrande = () => responderError(c, 400, "ARCHIVO_MUY_GRANDE", "El archivo pesa más de 10 MB, el máximo permitido");
  // Antes de leer el cuerpo: un archivo enorme se rechaza sin cargarlo en memoria
  if (Number(c.req.header("Content-Length") ?? 0) > TAMANO_MAXIMO + 64 * 1024) return muyGrande();

  const requerido = () => responderError(c, 400, "ARCHIVO_REQUERIDO", "Adjunta el archivo que quieres subir");
  let formulario: FormData;
  try {
    formulario = await c.req.formData();
  } catch {
    return requerido();
  }
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return requerido();
  if (archivo.size > TAMANO_MAXIMO) return muyGrande();

  const datos = await archivo.arrayBuffer();
  const formato = formatoDe(archivo.name, new Uint8Array(datos, 0, Math.min(16, datos.byteLength)));
  if (!formato) return responderError(c, 400, "FORMATO_NO_PERMITIDO", `${MENSAJE_FORMATOS}.`);
  return { datos, nombre: nombreSeguro(archivo.name, formato), formato };
}

const entregaCalificada = (c: Context<AppEnv>) =>
  responderError(c, 409, "ENTREGA_CALIFICADA", "Tu entrega ya fue calificada: no se puede reemplazar");

// Entrega del estudiante: crear o reemplazar mientras no tenga nota (spec "Entrega de archivos" y
// "Reemplazo de la entrega"). Se acepta después de la fecha límite: "tardía" se calcula al leer (D20).
archivosDeActividad.post("/:id/entrega", async (c) => {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  const usuario = c.var.usuario;
  if (usuario.rol !== "estudiante") return accesoDenegado(c);

  const archivo = await archivoDeLaPeticion(c);
  if (archivo instanceof Response) return archivo;

  const db = c.env.DB;
  const anterior = await db
    .prepare("SELECT archivo_key, nota FROM entregas WHERE actividad_id = ? AND estudiante_id = ?")
    .bind(actividad.id, usuario.id)
    .first<{ archivo_key: string; nota: number | null }>();
  if (anterior && anterior.nota !== null) return entregaCalificada(c);

  const almacen = almacenDe(c.env);
  const llave = `entregas/${actividad.id}/${usuario.id}/${crypto.randomUUID()}.${archivo.formato.extension}`;
  await almacen.guardar(llave, archivo.datos, archivo.formato.mime);
  try {
    await db
      .prepare(
        `INSERT INTO entregas (actividad_id, estudiante_id, archivo_key, nombre_archivo, tipo_mime, tamano_bytes, entregado_en)
         VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT (actividad_id, estudiante_id) DO UPDATE SET
           archivo_key = excluded.archivo_key, nombre_archivo = excluded.nombre_archivo, tipo_mime = excluded.tipo_mime,
           tamano_bytes = excluded.tamano_bytes, entregado_en = excluded.entregado_en`,
      )
      .bind(actividad.id, usuario.id, llave, archivo.nombre, archivo.formato.mime, archivo.datos.byteLength)
      .run();
  } catch (error) {
    // No se guardó la fila: el archivo nuevo no debe quedar huérfano
    await almacen.eliminar(llave);
    // El docente calificó entre la consulta y el guardado: el trigger de D13 lo detiene
    if (error instanceof Error && error.message.includes("ENTREGA_CALIFICADA")) return entregaCalificada(c);
    throw error;
  }
  if (anterior && !esCompartida(anterior.archivo_key)) await almacen.eliminar(anterior.archivo_key);

  const fila = await db
    .prepare(
      `SELECT e.id AS entrega_id, e.entregado_en, e.nota, e.comentario, e.nombre_archivo, a.fecha_limite
         FROM entregas e JOIN actividades a ON a.id = e.actividad_id
        WHERE e.actividad_id = ? AND e.estudiante_id = ?`,
    )
    .bind(actividad.id, usuario.id)
    .first<Parameters<typeof aEntrega>[0]>();
  return c.json(aEntrega(fila!), 201);
});

// Archivo de apoyo: solo el docente del curso lo adjunta, reemplaza o quita (spec "Publicación de actividades")
async function cambiarApoyo(c: Context<AppEnv>, nuevo: { llave: string } | null) {
  const actividad = await actividadVisible(c, idDeRuta(c));
  if (actividad instanceof Response) return actividad;
  if (!esDocenteDelCurso(c, actividad.docente_id)) return accesoDenegado(c);

  let llave: string | null = null;
  const almacen = almacenDe(c.env);
  if (nuevo) {
    const archivo = await archivoDeLaPeticion(c);
    if (archivo instanceof Response) return archivo;
    llave = `apoyos/${actividad.id}/${crypto.randomUUID()}.${archivo.formato.extension}`;
    await almacen.guardar(llave, archivo.datos, archivo.formato.mime);
  }
  await c.env.DB.prepare("UPDATE actividades SET archivo_apoyo_key = ? WHERE id = ?").bind(llave, actividad.id).run();
  if (actividad.archivo_apoyo_key && !esCompartida(actividad.archivo_apoyo_key)) await almacen.eliminar(actividad.archivo_apoyo_key);

  const [vista] = await vistaDocente(c.env.DB, { actividadId: actividad.id });
  return c.json(vista);
}

archivosDeActividad.put("/:id/apoyo", (c) => cambiarApoyo(c, { llave: "" }));
archivosDeActividad.delete("/:id/apoyo", (c) => cambiarApoyo(c, null));
