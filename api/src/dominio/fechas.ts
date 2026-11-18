// Fecha-hora de Colombia → UTC (design.md D9 y D20). Colombia no tiene horario de verano desde 1993: su
// diferencia con UTC es fija (−05:00), así que la conversión no depende de la zona horaria del navegador
// ni del servidor.

const FORMATO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// "2026-11-23T23:59" en Colombia → "2026-11-24T04:59:00Z". Null si no es una fecha-hora válida.
export function bogotaAUtc(local: string): string | null {
  const partes = FORMATO_LOCAL.exec(local);
  if (!partes) return null;
  // Sin segundos, el grupo llega undefined: Number(undefined) es NaN, así que se reemplaza antes por 0
  const [anio, mes, dia, hora, minuto, segundo] = partes.slice(1).map((parte) => Number(parte ?? 0));
  if (hora > 23 || minuto > 59 || segundo > 59) return null;

  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora + 5, minuto, segundo));
  // Date corrige fechas imposibles (30 de febrero → 2 de marzo): se detectan comparando la fecha local
  const local5 = new Date(fecha.getTime() - 5 * 3_600_000);
  if (local5.getUTCFullYear() !== anio || local5.getUTCMonth() !== mes - 1 || local5.getUTCDate() !== dia) return null;

  return `${fecha.toISOString().slice(0, 19)}Z`;
}

// "2026-11-24T04:59:00Z" → "2026-11-23 23:59" en Colombia. La usa el asistente: al modelo le llegan las fechas
// límite como las vería el estudiante (RAG tarea 3.1)
export function utcABogota(utc: string): string {
  const local = new Date(new Date(utc).getTime() - 5 * 3_600_000);
  return local.toISOString().slice(0, 16).replace("T", " ");
}
