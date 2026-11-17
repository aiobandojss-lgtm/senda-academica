import { describe, expect, it } from "vitest";
import { bogotaAUtc } from "../src/dominio/fechas";

// Grupo 4: la fecha límite se escribe en hora de Colombia y se guarda en UTC (spec "Edición de actividades", D20)

describe("bogotaAUtc", () => {
  it("las 11:59 p. m. del 23 en Colombia son las 4:59 a. m. del 24 en UTC", () => {
    expect(bogotaAUtc("2026-11-23T23:59")).toBe("2026-11-24T04:59:00Z");
  });

  it("cruza meses y años", () => {
    expect(bogotaAUtc("2026-12-31T20:00")).toBe("2027-01-01T01:00:00Z");
  });

  it("acepta segundos", () => {
    expect(bogotaAUtc("2026-11-23T08:30:15")).toBe("2026-11-23T13:30:15Z");
  });

  it("rechaza lo que no es una fecha-hora válida", () => {
    expect(bogotaAUtc("23/11/2026 23:59")).toBeNull();
    expect(bogotaAUtc("2026-02-30T10:00")).toBeNull();
    expect(bogotaAUtc("2026-11-23")).toBeNull();
    expect(bogotaAUtc("2026-11-23T24:00")).toBeNull();
  });
});
