import { describe, expect, it } from "vitest";
import { estadoDeCuota, fechasDelPlan } from "../src/dominio/cuotas";

// Tarea 5.2: fechas del plan de cuotas y estado de cada cuota (spec `cartera`), funciones puras

describe("fechasDelPlan", () => {
  it("generar seis cuotas: vencen el mismo día de agosto a enero", () => {
    expect(fechasDelPlan("2026-08-05", 6)).toEqual(["2026-08-05", "2026-09-05", "2026-10-05", "2026-11-05", "2026-12-05", "2027-01-05"]);
  });

  it("plan que empieza un día 31: en los meses cortos vence el último día", () => {
    expect(fechasDelPlan("2027-01-31", 3)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("respeta los años bisiestos y no arrastra el día corto a los meses siguientes", () => {
    expect(fechasDelPlan("2028-01-30", 3)).toEqual(["2028-01-30", "2028-02-29", "2028-03-30"]);
  });
});

describe("estadoDeCuota", () => {
  const HOY = "2026-11-20";

  it("pagada si no tiene saldo, aunque esté vencida", () => {
    expect(estadoDeCuota({ fechaVencimiento: "2026-10-05", saldo: 0 }, HOY)).toEqual({ estado: "pagada", diasAtraso: 0 });
  });

  it("pendiente si tiene saldo y no ha vencido (vence hoy o después)", () => {
    expect(estadoDeCuota({ fechaVencimiento: "2026-12-05", saldo: 180_000 }, HOY)).toEqual({ estado: "pendiente", diasAtraso: 0 });
    expect(estadoDeCuota({ fechaVencimiento: HOY, saldo: 180_000 }, HOY)).toEqual({ estado: "pendiente", diasAtraso: 0 });
  });

  it("vencida con sus días de atraso", () => {
    expect(estadoDeCuota({ fechaVencimiento: "2026-10-05", saldo: 80_000 }, HOY)).toEqual({ estado: "vencida", diasAtraso: 46 });
  });
});
