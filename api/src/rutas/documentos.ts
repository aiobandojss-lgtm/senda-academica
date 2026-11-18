import { Hono, type Context } from "hono";
import { z } from "zod";
import { fragmentarDocumento } from "../dominio/fragmentacion";
import { responderError, validarJson } from "../errores";
import { serviciosRag, ServicioIaNoDisponible } from "../rag/servicios";
import { requiereRol } from "../seguridad/permisos";
import type { AppEnv } from "../tipos";
import { texto } from "../validacion";

// Documentos oficiales que el asistente puede citar (spec `base-conocimiento`; RAG design.md D2 y D3). Solo el
// administrador. Un documento se identifica por su clave (el nombre del archivo, sin extensión): cargarlo otra vez
// con la misma clave lo reemplaza. Por ahora no hay pantalla: se usa con `npm run rag:indexar` (decisión de Aymer).
export const documentos = new Hono<AppEnv>();
documentos.use("*", requiereRol("admin"));

// Igual que el CHECK de documentos.tipo en migrations/0002_base_conocimiento.sql
const TIPOS_DOCUMENTO_OFICIAL = ["reglamento", "calendario", "plan_estudios", "preguntas_frecuentes", "otro"] as const;
// Igual que el CHECK de documentos.clave
const CLAVE = /^[A-Za-z0-9-]{1,60}$/;
// ~100 fragmentos como máximo: cada uno es una llamada de embeddings que gasta cuota
const MAXIMO_CONTENIDO = 100_000;

const esquemaDocumento = z.object({
  titulo: texto("Escribe el título del documento", 200, "El título"),
  tipo: z.enum(TIPOS_DOCUMENTO_OFICIAL, {
    error: "Elige el tipo: reglamento, calendario, plan_estudios, preguntas_frecuentes u otro",
  }),
  // Sin carrera (o null) = documento general, para todas las carreras
  carreraId: z
    .number({ error: "La carrera debe ser un número" })
    .int("La carrera debe ser un número entero")
    .positive("La carrera debe ser un número positivo")
    .nullable()
    .optional(),
  contenido: z
    .string({ error: "Escribe el contenido del documento en Markdown o texto" })
    .max(MAXIMO_CONTENIDO, `El documento tiene máximo ${MAXIMO_CONTENIDO.toLocaleString("es-CO")} caracteres`),
});

type FilaDocumento = {
  id: number;
  clave: string;
  titulo: string;
  tipo: string;
  carrera_id: number | null;
  carrera_codigo: string | null;
  carrera_nombre: string | null;
  fragmentos: number;
  actualizado_en: string;
};

const claveDeRuta = (c: Context) => {
  const clave = c.req.param("clave") ?? "";
  return CLAVE.test(clave) ? clave : null;
};

const claveInvalida = (c: Context) =>
  responderError(c, 400, "SOLICITUD_INVALIDA", "La clave del documento debe tener de 1 a 60 letras, números o guiones");

const servicioNoDisponible = (c: Context, error: ServicioIaNoDisponible, mensaje: string) => {
  // Habeas Data: solo la ruta y el error del servicio, nunca el contenido
  console.warn("Servicio de IA no disponible", { ruta: c.req.path, error: error.message });
  return responderError(c, 503, "SERVICIO_IA_NO_DISPONIBLE", mensaje);
};

documentos.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.clave, d.titulo, d.tipo, d.carrera_id, k.codigo AS carrera_codigo, k.nombre AS carrera_nombre,
       d.actualizado_en, (SELECT COUNT(*) FROM fragmentos f WHERE f.documento_id = d.id) AS fragmentos
     FROM documentos d LEFT JOIN carreras k ON k.id = d.carrera_id
     ORDER BY d.titulo`,
  ).all<FilaDocumento>();
  return c.json(
    results.map((f) => ({
      id: f.id,
      clave: f.clave,
      titulo: f.titulo,
      tipo: f.tipo,
      carrera: f.carrera_id === null ? null : { id: f.carrera_id, codigo: f.carrera_codigo, nombre: f.carrera_nombre },
      fragmentos: f.fragmentos,
      actualizadoEn: f.actualizado_en,
    })),
  );
});

// Carga o reemplaza un documento. Orden pensado para que una falla deje la base en un estado seguro:
// 1. Fragmentar y calcular los vectores ANTES de tocar D1: si la IA falla, el documento anterior queda intacto.
// 2. En una sola transacción de D1 (batch): guardar el documento y cambiar sus fragmentos viejos por los nuevos.
//    Desde ese momento el asistente ya no puede usar los viejos: cada resultado de Vectorize se cruza con D1 (D3).
// 3. Guardar los vectores nuevos y borrar los viejos en Vectorize, que los aplica unos segundos después.
documentos.put("/:clave", validarJson(esquemaDocumento), async (c) => {
  const clave = claveDeRuta(c);
  if (!clave) return claveInvalida(c);
  const datos = c.req.valid("json");
  const carreraId = datos.carreraId ?? null;
  const db = c.env.DB;

  if (carreraId !== null) {
    const carrera = await db.prepare("SELECT id FROM carreras WHERE id = ?").bind(carreraId).first();
    if (!carrera) return responderError(c, 404, "CARRERA_NO_ENCONTRADA", "La carrera no existe");
  }

  const fragmentos = fragmentarDocumento(datos.contenido);
  if (fragmentos.length === 0) {
    return responderError(c, 400, "DOCUMENTO_SIN_TEXTO", "El documento no tiene texto para indexar, solo títulos");
  }

  const rag = serviciosRag(c.env);
  let valores: number[][];
  try {
    // Con el título y la sección, el vector representa mejor de qué trata el fragmento
    valores = await rag.embeddings.generar(fragmentos.map((f) => `${datos.titulo} – ${f.seccion}\n\n${f.contenido}`));
  } catch (error) {
    if (!(error instanceof ServicioIaNoDisponible)) throw error;
    return servicioNoDisponible(c, error, "El servicio de IA no respondió y el documento no se cambió. Intenta de nuevo en unos minutos");
  }

  const [existente, anteriores, guardado, , insertados] = await db.batch([
    db.prepare("SELECT id FROM documentos WHERE clave = ?").bind(clave),
    db.prepare("SELECT f.id FROM fragmentos f JOIN documentos d ON d.id = f.documento_id WHERE d.clave = ?").bind(clave),
    db
      .prepare(
        `INSERT INTO documentos (clave, titulo, tipo, carrera_id, contenido) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (clave) DO UPDATE SET titulo = excluded.titulo, tipo = excluded.tipo, carrera_id = excluded.carrera_id,
           contenido = excluded.contenido, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         RETURNING id`,
      )
      .bind(clave, datos.titulo, datos.tipo, carreraId, datos.contenido),
    db.prepare("DELETE FROM fragmentos WHERE documento_id = (SELECT id FROM documentos WHERE clave = ?)").bind(clave),
    // Todos los fragmentos en una sola sentencia (json_each): el plan Free de D1 limita las consultas por petición
    db
      .prepare(
        `INSERT INTO fragmentos (documento_id, orden, seccion, contenido)
         SELECT (SELECT id FROM documentos WHERE clave = ?), json_extract(value, '$.orden'),
           json_extract(value, '$.seccion'), json_extract(value, '$.contenido')
         FROM json_each(?)
         RETURNING id, orden`,
      )
      .bind(clave, JSON.stringify(fragmentos)),
  ]);

  const documentoId = (guardado.results[0] as { id: number }).id;
  const idPorOrden = new Map((insertados.results as { id: number; orden: number }[]).map((f) => [f.orden, f.id]));
  const idsAnteriores = (anteriores.results as { id: number }[]).map((f) => f.id);

  try {
    await rag.indice.guardar(
      fragmentos.map((f, i) => ({ fragmentoId: idPorOrden.get(f.orden)!, valores: valores[i], documentoId, carreraId, tipo: datos.tipo })),
    );
    await rag.indice.eliminar(idsAnteriores);
  } catch (error) {
    if (!(error instanceof ServicioIaNoDisponible)) throw error;
    // D1 ya tiene la versión nueva; los vectores viejos que queden en Vectorize se descartan al cruzarlos con D1
    return servicioNoDisponible(
      c,
      error,
      "El documento se guardó, pero el índice de búsqueda no respondió. Vuelve a cargarlo en unos minutos para que el asistente lo use",
    );
  }

  return c.json(
    {
      documento: { id: documentoId, clave, titulo: datos.titulo, tipo: datos.tipo, carreraId, fragmentos: fragmentos.length },
      // Para que el script de indexación muestre en qué espacio quedó (produccion o local, D2)
      espacio: rag.indice.espacio,
    },
    existente.results.length === 0 ? 201 : 200,
  );
});

// Retira un documento: primero de D1 (desde ese momento ninguna respuesta lo puede citar) y luego sus vectores
documentos.delete("/:clave", async (c) => {
  const clave = claveDeRuta(c);
  if (!clave) return claveInvalida(c);
  const db = c.env.DB;

  const [fragmentos, borrado] = await db.batch([
    db.prepare("SELECT f.id FROM fragmentos f JOIN documentos d ON d.id = f.documento_id WHERE d.clave = ?").bind(clave),
    // Los fragmentos se borran en cascada (ON DELETE CASCADE)
    db.prepare("DELETE FROM documentos WHERE clave = ? RETURNING id").bind(clave),
  ]);
  if (borrado.results.length === 0) return responderError(c, 404, "DOCUMENTO_NO_ENCONTRADO", "El documento no existe");

  try {
    await serviciosRag(c.env).indice.eliminar((fragmentos.results as { id: number }[]).map((f) => f.id));
  } catch (error) {
    if (!(error instanceof ServicioIaNoDisponible)) throw error;
    // El documento ya no existe en D1, así que sus vectores huérfanos nunca se usan (D3): basta con dejar constancia
    console.warn("No se pudieron borrar los vectores de un documento retirado", { ruta: c.req.path, error: error.message });
  }
  return c.body(null, 204);
});
