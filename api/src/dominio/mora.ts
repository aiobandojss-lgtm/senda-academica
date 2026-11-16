// Estado de cartera de un estudiante (spec `bloqueo-mora`, design.md D6). Se calcula al vuelo, nunca se
// guarda: al registrar un pago, el estado cambia en la siguiente petición (desbloqueo inmediato).

export type EstadoMora = "al_dia" | "en_riesgo" | "bloqueado" | "con_excepcion";
export const ESTADOS_MORA: readonly EstadoMora[] = ["al_dia", "en_riesgo", "bloqueado", "con_excepcion"];

// Fechas de negocio en formato YYYY-MM-DD (D9); saldo en pesos enteros (valor menos pagos no anulados)
export type CuotaMora = { fechaVencimiento: string; saldo: number };
// `hasta` es inclusive: la excepción vale todo ese día
export type ExcepcionMora = { hasta: string };

// Bloqueado con MÁS de 30 días de atraso (31 o más): a los 30 todavía está en riesgo
const DIAS_PARA_BLOQUEO = 30;
const MS_POR_DIA = 86_400_000;

// Días de calendario entre dos fechas YYYY-MM-DD. Se calculan en UTC para que no influyan zonas horarias
// ni cambios de hora: solo importa la fecha.
function diasEntre(desde: string, hasta: string): number {
  const aUtc = (fecha: string) => {
    const [anio, mes, dia] = fecha.split("-").map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA);
}

// Función pura: "hoy" llega como parámetro (en America/Bogota, ver hoyEnBogota) para poder probar cualquier
// fecha. Las fechas YYYY-MM-DD se pueden comparar como texto.
export function calcularEstadoMora(cuotas: CuotaMora[], excepciones: ExcepcionMora[], hoy: string): EstadoMora {
  // Vencida: con saldo y con la fecha de vencimiento ya pasada (el día del vencimiento todavía no cuenta)
  const atrasos = cuotas.filter((c) => c.saldo > 0 && c.fechaVencimiento < hoy).map((c) => diasEntre(c.fechaVencimiento, hoy));
  if (atrasos.length === 0) return "al_dia";

  const cumpleBloqueo = atrasos.some((dias) => dias > DIAS_PARA_BLOQUEO);
  if (!cumpleBloqueo) return "en_riesgo";

  const excepcionVigente = excepciones.some((e) => e.hasta >= hoy);
  return excepcionVigente ? "con_excepcion" : "bloqueado";
}

// Fecha de hoy en Colombia. Los Workers corren en UTC: entre las 7 p. m. y la medianoche de Colombia, UTC
// ya va en el día siguiente, y un estudiante podría bloquearse un día antes de tiempo.
// "en-CA" da el formato YYYY-MM-DD.
const FORMATO_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hoyEnBogota(ahora: Date = new Date()): string {
  return FORMATO_BOGOTA.format(ahora);
}

// Estados de cartera de todos los estudiantes, o de uno, con dos consultas: solo trae lo que puede
// cambiar el estado (cuotas vencidas con saldo y excepciones vigentes). Quien no aparece está al día.
// Lo usan la lista de estudiantes del administrador y, en la tarea 5.3, el bloqueo al ingresar.
export async function estadosDeCartera(db: D1Database, hoy: string, estudianteId?: number): Promise<(id: number) => EstadoMora> {
  const filtro = estudianteId === undefined ? "" : "AND estudiante_id = ?";
  const parametros = estudianteId === undefined ? [hoy] : [hoy, estudianteId];
  const [cuotas, excepciones] = await db.batch<{ estudiante_id: number; fecha_vencimiento?: string; saldo?: number; hasta?: string }>([
    db
      .prepare(`SELECT estudiante_id, fecha_vencimiento, saldo FROM v_saldo_cuotas WHERE saldo > 0 AND fecha_vencimiento < ? ${filtro}`)
      .bind(...parametros),
    db.prepare(`SELECT estudiante_id, hasta FROM excepciones_mora WHERE hasta >= ? ${filtro}`).bind(...parametros),
  ]);

  const cuotasPor = new Map<number, CuotaMora[]>();
  for (const f of cuotas.results) {
    cuotasPor.set(f.estudiante_id, [...(cuotasPor.get(f.estudiante_id) ?? []), { fechaVencimiento: f.fecha_vencimiento!, saldo: f.saldo! }]);
  }
  const excepcionesPor = new Map<number, ExcepcionMora[]>();
  for (const f of excepciones.results) {
    excepcionesPor.set(f.estudiante_id, [...(excepcionesPor.get(f.estudiante_id) ?? []), { hasta: f.hasta! }]);
  }
  return (id) => calcularEstadoMora(cuotasPor.get(id) ?? [], excepcionesPor.get(id) ?? [], hoy);
}
