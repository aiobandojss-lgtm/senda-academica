import { diasEntre } from "./mora";

// Plan de cuotas y estado de cada cuota (spec `cartera`). Funciones puras: "hoy" llega como parámetro.

const dosDigitos = (n: number) => String(n).padStart(2, "0");

// Vencimientos mensuales el mismo día del primero. Si ese día no existe en un mes (29, 30 o 31), la cuota de
// ese mes vence el último día del mes, y el mes siguiente vuelve al día original (31 de enero → 28 de febrero
// → 31 de marzo).
export function fechasDelPlan(primerVencimiento: string, numero: number): string[] {
  const [anio, mes, dia] = primerVencimiento.split("-").map(Number);
  return Array.from({ length: numero }, (_, i) => {
    const primeroDelMes = new Date(Date.UTC(anio, mes - 1 + i, 1));
    const ultimoDia = new Date(Date.UTC(primeroDelMes.getUTCFullYear(), primeroDelMes.getUTCMonth() + 1, 0)).getUTCDate();
    return `${primeroDelMes.getUTCFullYear()}-${dosDigitos(primeroDelMes.getUTCMonth() + 1)}-${dosDigitos(Math.min(dia, ultimoDia))}`;
  });
}

export type EstadoCuota = { estado: "pagada" | "pendiente" | "vencida"; diasAtraso: number };

// Igual criterio que la mora (D6): vence el día siguiente a su fecha de vencimiento
export function estadoDeCuota(cuota: { fechaVencimiento: string; saldo: number }, hoy: string): EstadoCuota {
  if (cuota.saldo <= 0) return { estado: "pagada", diasAtraso: 0 };
  if (cuota.fechaVencimiento >= hoy) return { estado: "pendiente", diasAtraso: 0 };
  return { estado: "vencida", diasAtraso: diasEntre(cuota.fechaVencimiento, hoy) };
}
