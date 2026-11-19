import { describe, expect, it } from "vitest";
import { calcularEstadoMora, hoyEnBogota } from "../src/dominio/mora";

// Tarea 5.1: función pura del estado de cartera (spec `bloqueo-mora`, design.md D6).
// "Hoy" llega como parámetro: cada prueba fija su fecha y el resultado no depende del día en que se corra.

const HOY = "2026-11-05";
const cuota = (fechaVencimiento: string, saldo = 250_000) => ({ fechaVencimiento, saldo });

describe("calcularEstadoMora: regla de bloqueo", () => {
  it("31 días de atraso: bloqueado", () => {
    expect(calcularEstadoMora([cuota("2026-10-05")], [], HOY)).toBe("bloqueado");
  });

  it("exactamente 30 días de atraso: en riesgo, no bloqueado", () => {
    expect(calcularEstadoMora([cuota("2026-10-06")], [], HOY)).toBe("en_riesgo");
  });

  it("Pago parcial no desbloquea: la cuota de hace 40 días todavía tiene saldo", () => {
    expect(calcularEstadoMora([cuota("2026-09-26", 50_000)], [], HOY)).toBe("bloqueado");
  });

  it("cuotas al día: ninguna cuota vencida tiene saldo", () => {
    const cuotas = [cuota("2026-09-05", 0), cuota("2026-10-05", 0), cuota("2026-12-05")];
    expect(calcularEstadoMora(cuotas, [], HOY)).toBe("al_dia");
  });

  it("sin cuotas: al día", () => {
    expect(calcularEstadoMora([], [], HOY)).toBe("al_dia");
  });

  it("una cuota que vence hoy todavía no está vencida", () => {
    expect(calcularEstadoMora([cuota(HOY)], [], HOY)).toBe("al_dia");
  });

  it("basta una cuota con más de 30 días, aunque otra esté en riesgo", () => {
    expect(calcularEstadoMora([cuota("2026-10-26"), cuota("2026-09-05")], [], HOY)).toBe("bloqueado");
  });

  it("cuenta días de calendario a través del cambio de año", () => {
    // Del 31 de diciembre al 30 de enero hay 30 días; al 31 de enero, 31
    expect(calcularEstadoMora([cuota("2025-12-31")], [], "2026-01-30")).toBe("en_riesgo");
    expect(calcularEstadoMora([cuota("2025-12-31")], [], "2026-01-31")).toBe("bloqueado");
  });
});

describe("calcularEstadoMora: estados y excepciones", () => {
  it("en riesgo: la única cuota vencida con saldo venció hace 10 días", () => {
    expect(calcularEstadoMora([cuota("2026-10-26")], [], HOY)).toBe("en_riesgo");
  });

  it("con excepción: cumple la regla de bloqueo pero tiene una excepción vigente", () => {
    expect(calcularEstadoMora([cuota("2026-09-05")], [{ hasta: "2026-11-29" }], HOY)).toBe("con_excepcion");
  });

  it("la excepción vale hasta su último día, inclusive", () => {
    expect(calcularEstadoMora([cuota("2026-09-05")], [{ hasta: HOY }], HOY)).toBe("con_excepcion");
  });

  it("excepción vencida: vuelve a bloqueado", () => {
    expect(calcularEstadoMora([cuota("2026-09-05")], [{ hasta: "2026-11-04" }], HOY)).toBe("bloqueado");
  });

  it("basta una excepción vigente entre varias", () => {
    const excepciones = [{ hasta: "2026-10-01" }, { hasta: "2026-11-30" }];
    expect(calcularEstadoMora([cuota("2026-09-05")], excepciones, HOY)).toBe("con_excepcion");
  });

  it("una excepción no cambia a quien solo está en riesgo", () => {
    expect(calcularEstadoMora([cuota("2026-10-26")], [{ hasta: "2026-11-30" }], HOY)).toBe("en_riesgo");
  });
});

describe("hoyEnBogota", () => {
  it("usa la fecha de Colombia (UTC-5), no la de UTC", () => {
    // 3:00 a. m. UTC del 21 son las 10:00 p. m. del 20 en Bogotá: la noche de la presentación sigue siendo el 20
    expect(hoyEnBogota(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-20");
    expect(hoyEnBogota(new Date("2026-11-21T05:00:00Z"))).toBe("2026-11-21");
  });
});
