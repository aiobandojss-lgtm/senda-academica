// Formatos de presentación de Colombia (docs/identidad-visual.md): fechas en palabras y en hora de Colombia,
// notas con coma decimal. Cómo se guardan los datos lo define design.md D9.

const ZONA = "America/Bogota";

const FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

// "lunes, 23 de noviembre, 11:59 p. m."
export const fechaHora = (utc: string) => FECHA_HORA.format(new Date(utc));

// Para el campo datetime-local del formulario: "2026-11-23T23:59" en hora de Colombia (sin horario de verano)
export function aHoraColombia(utc: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(utc))
      .map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}

export const vencida = (utc: string) => new Date(utc).getTime() < Date.now();

// 4.2 → "4,2"
export const nota = (valor: number) => valor.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const TIPO_ACTIVIDAD = { taller: "Taller", evaluacion: "Evaluación" } as const;

// Dinero en pesos enteros (D9): 250000 → "$ 250.000", con un espacio que no se parte: en el celular el "$" nunca
// queda solo en una línea
const ESPACIO_DURO = String.fromCharCode(160);
export const pesos = (valor: number) => `$${ESPACIO_DURO}${String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// Fecha de negocio YYYY-MM-DD → "5 de diciembre de 2026". Se lee como fecha de calendario (UTC) para que la
// zona horaria del navegador no la corra un día.
const FECHA = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
export const fecha = (yyyyMmDd: string) => FECHA.format(new Date(`${yyyyMmDd}T00:00:00Z`));

// Hoy en Colombia como YYYY-MM-DD, para los valores por defecto de los formularios
export const hoyColombia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export const MEDIO_PAGO = { efectivo: "Efectivo", transferencia: "Transferencia", consignacion: "Consignación" } as const;
