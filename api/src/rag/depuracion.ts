import { hoyEnBogota } from "../dominio/mora";

// Retención de las conversaciones del asistente (RAG design.md D10). La ejecuta el Cron Trigger diario del Worker
// (api/src/index.ts). Los mensajes pueden traer datos personales que el estudiante escribe: Ley 1581 de 2012,
// finalidad y temporalidad, así que no se guardan más de 30 días.

export const DIAS_DE_RETENCION = 30;
const UN_DIA = 24 * 60 * 60 * 1000;

// Fecha-hora UTC en el formato de la base (D9 del MVP): 2026-12-01T08:00:00Z, sin milisegundos
const utc = (instante: Date) => instante.toISOString().replace(/\.\d{3}Z$/, "Z");

// Fecha de negocio YYYY-MM-DD menos unos días, contada como calendario (sin zona horaria)
const restarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) - dias * UN_DIA).toISOString().slice(0, 10);

export async function depurarAsistente(db: D1Database, ahora: Date = new Date()) {
  const [mensajes, contadores] = await db.batch([
    // Más de 30 días: lo creado hace 30 días justos todavía se conserva
    db.prepare("DELETE FROM asistente_mensajes WHERE creado_en < ?").bind(utc(new Date(ahora.getTime() - DIAS_DE_RETENCION * UN_DIA))),
    // Los contadores del límite diario (D9) no guardan contenido, pero tampoco hace falta conservarlos
    db.prepare("DELETE FROM asistente_uso WHERE fecha < ?").bind(restarDias(hoyEnBogota(ahora), DIAS_DE_RETENCION)),
  ]);
  return { mensajes: mensajes.meta.changes, contadores: contadores.meta.changes };
}
